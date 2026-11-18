//! Names that keep this fork independent from an upstream ClickPulse install.
//! Package validation names live in the updater and change in a later release.

pub const APP_NAME: &str = "ClickPulse Social";

/// Per-user data, cache and log folder.
pub const DATA_DIR: &str = "ClickPulse Social";
/// Folder shared with upstream ClickPulse before this separation.
pub const LEGACY_DATA_DIR: &str = "ClickPulse";

pub const LINUX_APP_ID: &str = "app.clickpulse.social";
pub const LINUX_STARTUP_FILE: &str = "app.clickpulse.social.desktop";
pub const LEGACY_LINUX_STARTUP_FILE: &str = "app.clickpulse.desktop.desktop";
pub const LINUX_LEGACY_ENTRY_NAME: &str = "ClickPulse";

pub const MAC_LOGIN_LABEL: &str = "app.clickpulse.social.login";
pub const LEGACY_MAC_LOGIN_LABEL: &str = "app.clickpulse.desktop.login";

pub const WINDOWS_RUN_VALUE: &str = "ClickPulse Social";
pub const LEGACY_WINDOWS_RUN_VALUE: &str = "ClickPulse";
