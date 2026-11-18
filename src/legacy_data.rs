//! One-time copy of the shared pre-separation profile into this app's own folder.
//! The old folder is never changed, so an upstream ClickPulse install keeps working.
use anyhow::{Context, Result};
use std::path::Path;

const MARKER: &str = "legacy-import.json";
/// Small settings files that belong to the user, not to a running process.
const FILES: [&str; 2] = ["presentation.json", "leaderboard.json"];

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    NotNeeded,
    Imported,
}

pub fn import_if_needed() -> Result<Outcome> {
    import_from(
        &crate::platform::legacy_data_dir()?,
        &crate::platform::data_dir()?,
    )
}

pub(crate) fn import_from(legacy: &Path, profile: &Path) -> Result<Outcome> {
    if legacy == profile || profile.join(MARKER).exists() || !legacy.is_dir() {
        return Ok(Outcome::NotNeeded);
    }
    let database = crate::storage::resolve(legacy)?;
    let target = crate::storage::resolve(profile)?;
    if target.exists() {
        // Statistics already exist here; never merge or replace them.
        return mark(profile, false);
    }
    std::fs::create_dir_all(profile)?;
    let copied = if database.is_file() {
        crate::storage::backup_file(&database, &target)
            .context("Copy statistics from the previous shared folder")?;
        true
    } else {
        false
    };
    for name in FILES {
        let (from, to) = (legacy.join(name), profile.join(name));
        if from.is_file() && !to.exists() {
            std::fs::copy(&from, &to).with_context(|| format!("Copy {name}"))?;
        }
    }
    mark(profile, copied)
}

fn mark(profile: &Path, copied: bool) -> Result<Outcome> {
    std::fs::create_dir_all(profile)?;
    std::fs::write(
        profile.join(MARKER),
        serde_json::to_vec_pretty(&serde_json::json!({
            "version": 1,
            "statistics_copied": copied,
            "imported_at": chrono::Local::now().to_rfc3339(),
        }))?,
    )?;
    Ok(Outcome::Imported)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        collector::CollectorDb,
        input::{Device, InputEvent},
    };

    fn legacy_with_history(root: &Path) -> std::path::PathBuf {
        let legacy = root.join("ClickPulse");
        std::fs::create_dir_all(&legacy).unwrap();
        let mut db = CollectorDb::open(&legacy.join("events.sqlite3")).unwrap();
        db.insert(&[InputEvent {
            ts_ms: chrono::Local::now().timestamp_millis(),
            device: Device::Keyboard,
            code: 0,
        }])
        .unwrap();
        std::fs::write(legacy.join("presentation.json"), b"{}").unwrap();
        std::fs::write(legacy.join("profile.lock"), b"").unwrap();
        legacy
    }

    #[test]
    fn copies_history_and_settings_once_and_leaves_the_original_untouched() {
        let temp = tempfile::tempdir().unwrap();
        let legacy = legacy_with_history(temp.path());
        let profile = temp.path().join("ClickPulse Social");
        assert_eq!(import_from(&legacy, &profile).unwrap(), Outcome::Imported);
        assert!(profile.join("events.sqlite3").is_file());
        assert!(profile.join("presentation.json").is_file());
        assert!(!profile.join("profile.lock").exists());
        assert!(legacy.join("events.sqlite3").is_file());
        // Later activity in either app does not flow across.
        let mut db = CollectorDb::open(&profile.join("events.sqlite3")).unwrap();
        db.insert(&[InputEvent {
            ts_ms: chrono::Local::now().timestamp_millis(),
            device: Device::Keyboard,
            code: 1,
        }])
        .unwrap();
        drop(db);
        assert_eq!(import_from(&legacy, &profile).unwrap(), Outcome::NotNeeded);
    }

    #[test]
    fn existing_statistics_are_never_replaced() {
        let temp = tempfile::tempdir().unwrap();
        let legacy = legacy_with_history(temp.path());
        let profile = temp.path().join("ClickPulse Social");
        std::fs::create_dir_all(&profile).unwrap();
        std::fs::write(profile.join("events.sqlite3"), b"keep").unwrap();
        import_from(&legacy, &profile).unwrap();
        assert_eq!(
            std::fs::read(profile.join("events.sqlite3")).unwrap(),
            b"keep"
        );
    }

    #[test]
    fn a_fresh_install_with_no_shared_folder_needs_nothing() {
        let temp = tempfile::tempdir().unwrap();
        let profile = temp.path().join("ClickPulse Social");
        assert_eq!(
            import_from(&temp.path().join("missing"), &profile).unwrap(),
            Outcome::NotNeeded
        );
        assert!(!profile.exists());
    }
}
