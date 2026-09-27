use crate::ProcessInfo;

#[cfg(windows)]
pub fn list() -> napi::Result<Vec<ProcessInfo>> {
  use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
  use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
  };

  // SAFETY: plain Win32 calls; the snapshot handle is closed on every path below.
  unsafe {
    let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if snapshot == INVALID_HANDLE_VALUE {
      return Err(napi::Error::from_reason("CreateToolhelp32Snapshot failed"));
    }

    let mut entry: PROCESSENTRY32W = std::mem::zeroed();
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

    let mut processes = Vec::with_capacity(512);
    let mut ok = Process32FirstW(snapshot, &mut entry);
    while ok != 0 {
      let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
      processes.push(ProcessInfo {
        pid: entry.th32ProcessID,
        name: String::from_utf16_lossy(&entry.szExeFile[..len]),
      });
      ok = Process32NextW(snapshot, &mut entry);
    }

    CloseHandle(snapshot);
    Ok(processes)
  }
}

#[cfg(not(windows))]
pub fn list() -> napi::Result<Vec<ProcessInfo>> {
  Err(napi::Error::from_reason("listProcesses is only implemented on Windows"))
}
