#![deny(clippy::all)]

use napi::threadsafe_function::ThreadsafeFunction;
use napi::Status;
use napi_derive::napi;

mod keys;
mod process;
mod screen;
mod window;

#[napi(object)]
pub struct ProcessInfo {
  pub pid: u32,
  /// Executable file name, e.g. "Risk of Rain 2.exe".
  pub name: String,
}

/// Rectangle in physical screen pixels.
#[napi(object)]
#[derive(Clone, Copy, PartialEq)]
pub struct Rect {
  pub x: i32,
  pub y: i32,
  pub width: i32,
  pub height: i32,
}

/// Snapshot of the tracked window. Every event carries the full state, so consumers can stay stateless.
#[napi(object)]
pub struct WindowSnapshot {
  /// What triggered this snapshot: "initial", "foreground", "move", "minimize", "restore" or "destroy".
  pub reason: String,
  /// Handle of the current foreground window.
  pub foreground: i64,
  pub target_focused: bool,
  pub minimized: bool,
  /// Client area of the tracked window. None while minimized or after it was destroyed.
  pub bounds: Option<Rect>,
}

/// Snapshot of running processes. Cheap enough to call every couple of seconds.
#[napi]
pub fn list_processes() -> napi::Result<Vec<ProcessInfo>> {
  process::list()
}

/// The largest visible, unowned top-level window of the process, if any.
#[napi]
pub fn find_main_window(pid: u32) -> Option<i64> {
  window::find_main_window(pid)
}

/// Start tracking one window. Replaces any tracker that is already running.
/// The callback first receives an "initial" snapshot, then one per relevant change.
#[napi]
pub fn start_window_tracking(
  hwnd: i64,
  callback: ThreadsafeFunction<WindowSnapshot, (), WindowSnapshot, Status, false>,
) -> napi::Result<()> {
  window::start_tracking(hwnd, callback)
}

#[napi]
pub fn stop_window_tracking() {
  window::stop_tracking();
}

/// True when every virtual-key code in `keys` is currently held down.
#[napi]
pub fn are_keys_down(keys: Vec<u32>) -> bool {
  keys::all_down(&keys)
}

/// Part of a window's client area, as fractions of its width and height (0..1).
#[napi(object)]
#[derive(Clone)]
pub struct ScreenRegion {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
  /// Enlargement before OCR; small HUD text reads better at 2x (the default).
  pub scale: Option<f64>,
}

pub struct ReadScreenText {
  hwnd: i64,
  regions: Vec<ScreenRegion>,
  language: String,
}

impl napi::Task for ReadScreenText {
  type Output = Vec<Vec<String>>;
  type JsValue = Vec<Vec<String>>;

  fn compute(&mut self) -> napi::Result<Self::Output> {
    Ok(screen::read_text(self.hwnd, &self.regions, &self.language))
  }

  fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    Ok(output)
  }
}

/// Reads text from regions of a window with Windows OCR, off the main thread.
/// Resolves to one list of text lines per region.
#[napi]
pub fn read_screen_text(hwnd: i64, regions: Vec<ScreenRegion>, language: Option<String>) -> napi::bindgen_prelude::AsyncTask<ReadScreenText> {
  napi::bindgen_prelude::AsyncTask::new(ReadScreenText { hwnd, regions, language: language.unwrap_or_default() })
}
