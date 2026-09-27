use napi::threadsafe_function::ThreadsafeFunction;
use napi::Status;

use crate::WindowSnapshot;

type SnapshotCallback = ThreadsafeFunction<WindowSnapshot, (), WindowSnapshot, Status, false>;

#[cfg(windows)]
mod imp {
  use std::cell::RefCell;
  use std::ptr::null_mut;
  use std::sync::{mpsc, Mutex};
  use std::thread::{self, JoinHandle};

  use napi::threadsafe_function::ThreadsafeFunctionCallMode;
  use windows_sys::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
  use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
  use windows_sys::Win32::System::Threading::GetCurrentThreadId;
  use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
  use windows_sys::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, EnumWindows, GetClientRect, GetForegroundWindow, GetMessageW, GetWindow, GetWindowRect,
    GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, PeekMessageW, PostThreadMessageW, TranslateMessage,
    EVENT_OBJECT_DESTROY, EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND,
    EVENT_SYSTEM_MINIMIZESTART, GW_OWNER, MSG, OBJID_WINDOW, PM_NOREMOVE, WINEVENT_OUTOFCONTEXT, WM_QUIT, WM_USER,
  };

  use super::SnapshotCallback;
  use crate::{Rect, WindowSnapshot};

  fn to_hwnd(value: i64) -> HWND {
    value as isize as HWND
  }

  fn from_hwnd(hwnd: HWND) -> i64 {
    hwnd as isize as i64
  }

  // ---- main window lookup -------------------------------------------------------------------

  struct Search {
    pid: u32,
    best: HWND,
    best_area: i64,
  }

  unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> i32 {
    let search = &mut *(lparam as *mut Search);
    let mut pid = 0;
    GetWindowThreadProcessId(hwnd, &mut pid);
    if pid == search.pid && IsWindowVisible(hwnd) != 0 && GetWindow(hwnd, GW_OWNER).is_null() {
      let mut rect: RECT = std::mem::zeroed();
      GetWindowRect(hwnd, &mut rect);
      let area = i64::from(rect.right - rect.left) * i64::from(rect.bottom - rect.top);
      if area > search.best_area {
        search.best = hwnd;
        search.best_area = area;
      }
    }
    1
  }

  pub fn find_main_window(pid: u32) -> Option<i64> {
    let mut search = Search { pid, best: null_mut(), best_area: 0 };
    // SAFETY: `search` outlives the synchronous EnumWindows call that receives a pointer to it.
    unsafe { EnumWindows(Some(enum_proc), &mut search as *mut Search as LPARAM) };
    (!search.best.is_null()).then(|| from_hwnd(search.best))
  }

  // ---- tracking -----------------------------------------------------------------------------

  struct Tracker {
    thread_id: u32,
    handle: JoinHandle<()>,
  }

  static TRACKER: Mutex<Option<Tracker>> = Mutex::new(None);

  /// Lives on the tracker thread only; WinEvent callbacks run on the thread that set the hook.
  struct Context {
    target: HWND,
    callback: SnapshotCallback,
    last_bounds: Option<Rect>,
  }

  thread_local! {
    static CONTEXT: RefCell<Option<Context>> = const { RefCell::new(None) };
  }

  unsafe fn client_bounds(hwnd: HWND) -> Option<Rect> {
    let mut rect: RECT = std::mem::zeroed();
    if GetClientRect(hwnd, &mut rect) == 0 {
      return None;
    }
    let mut origin = POINT { x: 0, y: 0 };
    if ClientToScreen(hwnd, &mut origin) == 0 {
      return None;
    }
    let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
    (width > 0 && height > 0).then_some(Rect { x: origin.x, y: origin.y, width, height })
  }

  impl Context {
    unsafe fn emit(&mut self, reason: &str) {
      let destroyed = reason == "destroy";
      let minimized = !destroyed && IsIconic(self.target) != 0;
      let bounds = if destroyed || minimized { None } else { client_bounds(self.target) };

      // Location changes also fire for moves that do not change the client area.
      if reason == "move" && bounds == self.last_bounds {
        return;
      }
      self.last_bounds = bounds;

      let foreground = GetForegroundWindow();
      self.callback.call(
        WindowSnapshot {
          reason: reason.to_owned(),
          foreground: from_hwnd(foreground),
          target_focused: !destroyed && foreground == self.target,
          minimized,
          bounds,
        },
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
  }

  unsafe extern "system" fn on_event(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
  ) {
    CONTEXT.with(|cell| {
      let mut guard = cell.borrow_mut();
      let Some(ctx) = guard.as_mut() else { return };
      let is_target = hwnd == ctx.target && id_object == OBJID_WINDOW;
      let reason = match event {
        EVENT_SYSTEM_FOREGROUND => "foreground",
        EVENT_SYSTEM_MINIMIZESTART if hwnd == ctx.target => "minimize",
        EVENT_SYSTEM_MINIMIZEEND if hwnd == ctx.target => "restore",
        EVENT_OBJECT_DESTROY if is_target => "destroy",
        EVENT_OBJECT_LOCATIONCHANGE if is_target => "move",
        _ => return,
      };
      ctx.emit(reason);
    });
  }

  unsafe fn run(hwnd: i64, pid: u32, callback: SnapshotCallback, ready: mpsc::Sender<u32>) {
    let mut msg: MSG = std::mem::zeroed();
    // Force the message queue to exist before the caller may post WM_QUIT to it.
    PeekMessageW(&mut msg, null_mut(), WM_USER, WM_USER, PM_NOREMOVE);

    let target = to_hwnd(hwnd);
    CONTEXT.with(|cell| *cell.borrow_mut() = Some(Context { target, callback, last_bounds: None }));

    let hook = |min: u32, max: u32, process: u32| {
      SetWinEventHook(min, max, null_mut(), Some(on_event), process, 0, WINEVENT_OUTOFCONTEXT)
    };
    let hooks = [
      // Foreground changes are global: we also need to know when focus leaves the game.
      hook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, 0),
      hook(EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND, pid),
      hook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_DESTROY, pid),
      hook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, pid),
    ];

    let _ = ready.send(GetCurrentThreadId());
    CONTEXT.with(|cell| {
      if let Some(ctx) = cell.borrow_mut().as_mut() {
        ctx.emit("initial");
      }
    });

    while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
      TranslateMessage(&msg);
      DispatchMessageW(&msg);
    }

    for hook in hooks {
      if !hook.is_null() {
        UnhookWinEvent(hook);
      }
    }
    CONTEXT.with(|cell| cell.borrow_mut().take());
  }

  pub fn start_tracking(hwnd: i64, callback: SnapshotCallback) -> napi::Result<()> {
    stop_tracking();

    let target = to_hwnd(hwnd);
    let mut pid = 0;
    // SAFETY: both calls accept any handle value and fail gracefully on invalid ones.
    unsafe {
      if IsWindow(target) == 0 {
        return Err(napi::Error::from_reason("window handle is not valid"));
      }
      GetWindowThreadProcessId(target, &mut pid);
    }

    let (ready_tx, ready_rx) = mpsc::channel();
    // SAFETY: `run` only touches Win32 state owned by the spawned thread.
    let handle = thread::spawn(move || unsafe { run(hwnd, pid, callback, ready_tx) });
    let thread_id = ready_rx
      .recv()
      .map_err(|_| napi::Error::from_reason("window tracker thread failed to start"))?;

    *TRACKER.lock().unwrap_or_else(|e| e.into_inner()) = Some(Tracker { thread_id, handle });
    Ok(())
  }

  pub fn stop_tracking() {
    let tracker = TRACKER.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Some(tracker) = tracker {
      // SAFETY: the tracker thread created its queue before reporting its id.
      unsafe { PostThreadMessageW(tracker.thread_id, WM_QUIT, 0, 0) };
      let _ = tracker.handle.join();
    }
  }
}

#[cfg(windows)]
pub use imp::{find_main_window, start_tracking, stop_tracking};

#[cfg(not(windows))]
pub fn find_main_window(_pid: u32) -> Option<i64> {
  None
}

#[cfg(not(windows))]
pub fn start_tracking(_hwnd: i64, _callback: SnapshotCallback) -> napi::Result<()> {
  Err(napi::Error::from_reason("window tracking is only implemented on Windows"))
}

#[cfg(not(windows))]
pub fn stop_tracking() {}
