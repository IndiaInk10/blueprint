// Reads text from parts of a game window: copies those pixels from the screen (like a screenshot,
// never touching the game process) and runs Windows' built-in OCR on them.
use crate::ScreenRegion;

#[cfg(windows)]
mod imp {
  use std::ptr::null_mut;

  use windows::core::HSTRING;
  use windows::Globalization::Language;
  use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
  use windows::Media::Ocr::OcrEngine;
  use windows::Security::Cryptography::CryptographicBuffer;
  use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
  use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
  use windows_sys::Win32::Graphics::Gdi::{
    ClientToScreen, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, ReleaseDC,
    SelectObject, SetStretchBltMode, StretchBlt, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HALFTONE, SRCCOPY,
  };
  use windows_sys::Win32::UI::WindowsAndMessaging::{GetClientRect, IsWindow};

  use crate::ScreenRegion;

  /// OCR reads small HUD text far better when it is enlarged first.
  const DEFAULT_SCALE: f64 = 2.0;
  /// Windows OCR rejects images larger than this on either side.
  const MAX_SIDE: i32 = 4000;

  pub struct Image {
    pub width: i32,
    pub height: i32,
    pub bgra: Vec<u8>,
  }

  /// Copies a region of the window's client area (fractions 0..1) from the screen, scaled up.
  pub fn capture(hwnd: i64, region: &ScreenRegion) -> Option<Image> {
    unsafe {
      let hwnd = hwnd as isize as HWND;
      if IsWindow(hwnd) == 0 {
        return None;
      }
      let mut client: RECT = std::mem::zeroed();
      if GetClientRect(hwnd, &mut client) == 0 {
        return None;
      }
      let mut origin = POINT { x: 0, y: 0 };
      ClientToScreen(hwnd, &mut origin);
      let (cw, ch) = (f64::from(client.right - client.left), f64::from(client.bottom - client.top));
      let sx = origin.x + (cw * region.x) as i32;
      let sy = origin.y + (ch * region.y) as i32;
      let sw = ((cw * region.width) as i32).max(1);
      let sh = ((ch * region.height) as i32).max(1);
      let scale = region.scale.unwrap_or(DEFAULT_SCALE).clamp(0.25, 4.0);
      let dw = ((f64::from(sw) * scale) as i32).clamp(1, MAX_SIDE);
      let dh = ((f64::from(sh) * scale) as i32).clamp(1, MAX_SIDE);

      let screen = GetDC(null_mut());
      let memory = CreateCompatibleDC(screen);
      let bitmap = CreateCompatibleBitmap(screen, dw, dh);
      let previous = SelectObject(memory, bitmap);
      SetStretchBltMode(memory, HALFTONE);
      let copied = StretchBlt(memory, 0, 0, dw, dh, screen, sx, sy, sw, sh, SRCCOPY) != 0;

      let mut info: BITMAPINFO = std::mem::zeroed();
      info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
      info.bmiHeader.biWidth = dw;
      // Negative height asks for top-down rows, which is what OCR expects.
      info.bmiHeader.biHeight = -dh;
      info.bmiHeader.biPlanes = 1;
      info.bmiHeader.biBitCount = 32;
      info.bmiHeader.biCompression = BI_RGB;
      let mut bgra = vec![0u8; (dw * dh * 4) as usize];
      let rows = GetDIBits(memory, bitmap, 0, dh as u32, bgra.as_mut_ptr().cast(), &mut info, DIB_RGB_COLORS);

      SelectObject(memory, previous);
      DeleteObject(bitmap);
      DeleteDC(memory);
      ReleaseDC(null_mut(), screen);
      if !copied || rows == 0 {
        return None;
      }
      // GDI leaves alpha at zero; make the image opaque.
      for pixel in bgra.chunks_exact_mut(4) {
        pixel[3] = 255;
      }
      Some(Image { width: dw, height: dh, bgra })
    }
  }

  /// Text lines Windows OCR finds in the image. `language` is a BCP-47 tag such as "ko"; empty
  /// uses the user's profile languages.
  pub fn recognize(image: &Image, language: &str) -> windows::core::Result<Vec<String>> {
    // Worker threads are not initialised for WinRT; repeat calls on the same thread are harmless.
    unsafe {
      let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
    let buffer = CryptographicBuffer::CreateFromByteArray(&image.bgra)?;
    let bitmap = SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, image.width, image.height)?;
    let engine = if language.is_empty() {
      OcrEngine::TryCreateFromUserProfileLanguages()?
    } else {
      OcrEngine::TryCreateFromLanguage(&Language::CreateLanguage(&HSTRING::from(language))?)?
    };
    let result = engine.RecognizeAsync(&bitmap)?.get()?;
    let mut lines = Vec::new();
    for line in result.Lines()? {
      lines.push(line.Text()?.to_string());
    }
    Ok(lines)
  }
}

/// Lines of text per region. A region that cannot be captured or read yields no lines.
#[cfg(windows)]
pub fn read_text(hwnd: i64, regions: &[ScreenRegion], language: &str) -> Vec<Vec<String>> {
  regions
    .iter()
    .map(|region| {
      imp::capture(hwnd, region)
        .and_then(|image| imp::recognize(&image, language).ok())
        .unwrap_or_default()
    })
    .collect()
}

#[cfg(not(windows))]
pub fn read_text(_hwnd: i64, regions: &[ScreenRegion], _language: &str) -> Vec<Vec<String>> {
  regions.iter().map(|_| Vec::new()).collect()
}
