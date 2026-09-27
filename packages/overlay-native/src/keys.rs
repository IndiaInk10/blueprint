#[cfg(windows)]
pub fn all_down(keys: &[u32]) -> bool {
  use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

  // Polling instead of a low-level keyboard hook: nothing is swallowed and the game sees every key.
  !keys.is_empty()
    && keys.iter().all(|&vk| {
      // SAFETY: GetAsyncKeyState has no preconditions.
      let state = unsafe { GetAsyncKeyState(vk as i32) };
      (state as u16 & 0x8000) != 0
    })
}

#[cfg(not(windows))]
pub fn all_down(_keys: &[u32]) -> bool {
  false
}
