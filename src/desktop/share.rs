use std::{borrow::Cow, cell::RefCell};

use anyhow::{Context, Result, ensure};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::GenericImageView;

const MAX_ENCODED_BYTES: usize = 32 * 1024 * 1024;
const MAX_PIXELS: u64 = 4_500_000;

thread_local! {
    // X11 owns clipboard data through the setting client. Retain that client for
    // the UI thread so copied cards remain available after this function returns.
    static CLIPBOARD: RefCell<Option<arboard::Clipboard>> = const { RefCell::new(None) };
}

fn decode_png(encoded: &str) -> Result<(Vec<u8>, image::RgbaImage)> {
    ensure!(
        !encoded.is_empty() && encoded.len() <= MAX_ENCODED_BYTES,
        "Invalid share-card image size"
    );
    let bytes = STANDARD
        .decode(encoded)
        .context("Invalid share-card image encoding")?;
    ensure!(
        bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "Share card must be PNG"
    );
    let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
        .context("Invalid share-card PNG")?;
    let (width, height) = image.dimensions();
    ensure!(
        width > 0 && height > 0 && u64::from(width) * u64::from(height) <= MAX_PIXELS,
        "Share-card dimensions are out of range"
    );
    Ok((bytes, image.into_rgba8()))
}

fn safe_filename(value: &str) -> String {
    let stem: String = value
        .trim_end_matches(".png")
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        .take(80)
        .collect();
    format!(
        "{}.png",
        if stem.is_empty() {
            "ClickPulse-card"
        } else {
            &stem
        }
    )
}

pub(super) fn save_png(encoded: &str, filename: &str) -> Result<bool> {
    let (bytes, _) = decode_png(encoded)?;
    let Some(path) = rfd::FileDialog::new()
        .add_filter("PNG image", &["png"])
        .set_file_name(safe_filename(filename))
        .save_file()
    else {
        return Ok(false);
    };
    std::fs::write(path, bytes).context("Could not save share card")?;
    Ok(true)
}

pub(super) fn copy_png(encoded: &str) -> Result<()> {
    let (_, image) = decode_png(encoded)?;
    let (width, height) = image.dimensions();
    CLIPBOARD.with(|stored| {
        let mut stored = stored.borrow_mut();
        if stored.is_none() {
            *stored = Some(arboard::Clipboard::new().context("Could not open the clipboard")?);
        }
        stored
            .as_mut()
            .expect("clipboard initialized above")
            .set_image(arboard::ImageData {
                width: width as usize,
                height: height as usize,
                bytes: Cow::Owned(image.into_raw()),
            })
            .context("Could not copy share card")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filenames_are_bounded_and_cannot_escape_the_dialog_destination() {
        assert_eq!(
            safe_filename("ClickPulse-2026-11-17.png"),
            "ClickPulse-2026-11-17.png"
        );
        assert_eq!(safe_filename("../../secret.png"), "secret.png");
        assert_eq!(safe_filename("\u{4eca}\u{65e5}.png"), "ClickPulse-card.png");
    }

    #[test]
    fn decoder_rejects_non_png_and_oversized_payloads() {
        assert!(decode_png(&STANDARD.encode(b"not png")).is_err());
        assert!(decode_png(&"A".repeat(MAX_ENCODED_BYTES + 1)).is_err());
    }
}
