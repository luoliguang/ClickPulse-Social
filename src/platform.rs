//! Platform paths and shell integration. Never select a checkout or backup as data.
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

pub fn name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "other"
    }
}

pub fn data_dir() -> Result<PathBuf> {
    data_dir_named(crate::identity::DATA_DIR)
}

/// Folder used before this fork separated its data from upstream ClickPulse.
pub fn legacy_data_dir() -> Result<PathBuf> {
    data_dir_named(crate::identity::LEGACY_DATA_DIR)
}

fn data_dir_named(name: &str) -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    return windows_data_dir(std::env::var_os("LOCALAPPDATA"), name);
    #[cfg(target_os = "macos")]
    return Ok(PathBuf::from(
        std::env::var_os("HOME").context("Cannot determine the user home directory")?,
    )
    .join("Library/Application Support")
    .join(name));
    #[cfg(target_os = "linux")]
    return Ok(linux::xdg_dir(
        std::env::var_os("XDG_DATA_HOME"),
        std::env::var_os("HOME"),
        ".local/share",
    )?
    .join(name));
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let base = std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })
            .context("User data directory is unavailable")?;
        Ok(base.join(name))
    }
}

#[cfg(any(target_os = "windows", test))]
fn windows_data_dir(local_app_data: Option<std::ffi::OsString>, name: &str) -> Result<PathBuf> {
    let base = PathBuf::from(local_app_data.context("LOCALAPPDATA is unavailable")?);
    anyhow::ensure!(base.is_absolute(), "LOCALAPPDATA must be an absolute path");
    Ok(base.join(name))
}

pub fn log_path() -> Result<PathBuf> {
    #[cfg(target_os = "macos")]
    return Ok(PathBuf::from(
        std::env::var_os("HOME").context("Cannot determine the log directory")?,
    )
    .join("Library/Logs/clickpulse-social.log"));
    #[cfg(not(target_os = "macos"))]
    Ok(data_dir()?.join("logs/clickpulse.log"))
}

pub fn auto_start_enabled() -> bool {
    #[cfg(target_os = "macos")]
    return crate::handoff::auto_start_enabled();
    #[cfg(target_os = "windows")]
    return crate::platform::windows::auto_start_enabled();
    #[cfg(target_os = "linux")]
    return linux::auto_start_enabled();
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    false
}

/// Move this program's startup entry away from the name shared with upstream.
#[cfg(any(target_os = "windows", target_os = "linux"))]
pub fn adopt_legacy_auto_start() -> Result<bool> {
    #[cfg(target_os = "windows")]
    return windows::adopt_legacy_auto_start();
    #[cfg(target_os = "linux")]
    return linux::adopt_legacy_auto_start();
}

pub fn set_auto_start(enabled: bool) -> Result<()> {
    #[cfg(target_os = "macos")]
    return crate::handoff::set_auto_start(enabled);
    #[cfg(target_os = "windows")]
    return windows::set_auto_start(enabled);
    #[cfg(target_os = "linux")]
    return linux::set_auto_start(enabled);
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = enabled;
        anyhow::bail!("Desktop startup is unsupported on this platform")
    }
}

pub fn reveal(path: &Path) -> Result<()> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()?;
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer.exe")
        .arg(path.parent().context("Data directory is unavailable")?)
        .spawn()?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(path.parent().context("Data directory is unavailable")?)
        .spawn()?;
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = path;
        anyhow::bail!("Desktop file browser is unsupported on this platform")
    }
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    Ok(())
}

#[cfg(target_os = "windows")]
#[path = "platform_windows.rs"]
pub mod windows;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_data_directory_never_resolves_relative_to_the_working_directory() {
        assert!(windows_data_dir(None, "X").is_err());
        for value in ["", ".", "profile/AppData/Local"] {
            assert!(windows_data_dir(Some(value.into()), "X").is_err());
        }
        #[cfg(target_os = "windows")]
        for value in [
            r"C:Users\tester\AppData\Local",
            r"\Users\tester\AppData\Local",
        ] {
            assert!(windows_data_dir(Some(value.into()), "X").is_err());
        }
        let profile = tempfile::tempdir().unwrap();
        let base = profile.path().join("AppData").join("Local");
        assert_eq!(
            windows_data_dir(
                Some(base.clone().into_os_string()),
                crate::identity::DATA_DIR
            )
            .unwrap(),
            base.join("ClickPulse Social")
        );
        assert!(!base.exists(), "resolving a path must not create user data");
    }
}

#[cfg(any(target_os = "linux", test))]
#[path = "platform_linux.rs"]
pub mod linux;
