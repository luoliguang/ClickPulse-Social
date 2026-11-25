use super::UiEvent;
use anyhow::{Context, Result, ensure};
use clickpulse::leaderboard::{self, DailyCount, Period};
use serde_json::{Value, json};
use std::{path::PathBuf, thread};
use tao::event_loop::EventLoopProxy;

fn finish(proxy: EventLoopProxy<UiEvent>, result: Result<Value>) {
    let _ = proxy.send_event(UiEvent::Leaderboard(
        result.map_err(|error| format!("{error:#}")),
    ));
}

fn finish_background(proxy: EventLoopProxy<UiEvent>, result: Result<Value>) {
    let _ = proxy.send_event(UiEvent::LeaderboardBackground(
        result.map_err(|error| format!("{error:#}")),
    ));
}

fn finish_activity(proxy: EventLoopProxy<UiEvent>, result: Result<Value>) {
    let _ = proxy.send_event(UiEvent::LeaderboardActivity(
        result.map_err(|error| format!("{error:#}")),
    ));
}

fn finish_visibility(proxy: EventLoopProxy<UiEvent>, result: Result<Value>) {
    let _ = proxy.send_event(UiEvent::LeaderboardVisibility(
        result.map_err(|error| format!("{error:#}")),
    ));
}

fn spawn(proxy: EventLoopProxy<UiEvent>, task: impl FnOnce() -> Result<Value> + Send + 'static) {
    thread::Builder::new()
        .name("clickpulse-leaderboard".into())
        .spawn(move || finish(proxy, task()))
        .ok();
}

fn state(period: Period, page: u64) -> Result<Value> {
    let profile = leaderboard::load_profile()?;
    let board = match &profile {
        Some(profile) => Some(leaderboard::board(Some(profile), period, page)?),
        None => None,
    };
    let mut summary = leaderboard::profile_summary(profile.as_ref());
    if let Some(profile) = &profile {
        summary["activity_supported"] = Value::Bool(false);
        if let Ok(Some(visible)) = leaderboard::me(profile) {
            summary["activity_supported"] = Value::Bool(true);
            summary["activity_visible"] = Value::Bool(visible);
        }
    }
    Ok(json!({"profile":summary,"board":board}))
}

fn state_background(period: Period, page: u64) -> Result<Value> {
    let profile = leaderboard::load_profile()?;
    let board = match &profile {
        Some(profile) => Some(leaderboard::board(Some(profile), period, page)?),
        None => None,
    };
    Ok(json!({"profile":leaderboard::profile_summary(profile.as_ref()),"board":board}))
}

pub(super) fn demo(period: Period) -> Value {
    let period_name = match period {
        Period::Today => "today",
        Period::Week => "week",
    };
    let entries = [
        ("m1", "Lin", "designer", 24_820, 5_416, "#7c3aed"),
        ("demo", "罗洋洋", "developer", 21_460, 4_982, "#2563eb"),
        ("m3", "Mika", "student", 18_305, 3_744, "#0f766e"),
        ("m4", "Alex", "operations", 15_920, 4_101, "#c2410c"),
        ("m5", "小北", "writer", 12_638, 2_877, "#be123c"),
    ].into_iter().enumerate().map(|(index, (id, nickname, role, keyboard, mouse, color))| json!({
        "rank":index + 1,"member_id":id,"nickname":nickname,"role":role,
        "avatar":{"url":null,"initial":nickname.chars().next().unwrap_or('?').to_string(),"color":color},
        "keyboard":keyboard,"mouse":mouse,"total":keyboard + mouse,"is_self":id == "demo"
    })).collect::<Vec<_>>();
    let self_entry = entries
        .iter()
        .find(|entry| entry["member_id"] == "demo")
        .cloned();
    json!({
        "profile":{"joined":true,"member_id":"demo","nickname":"罗洋洋","role":"developer","activity_supported":false,"activity_visible":false,"demo":true},
        "board":{"period":period_name,"starts_on":"2026-11-10","ends_on":"2026-11-16","entries":entries,"self_rank":2,"page":1,"page_size":20,"total_entries":5,"total_pages":1,"self_entry":self_entry}
    })
}

pub(super) fn load(proxy: EventLoopProxy<UiEvent>, period: Period, page: u64) {
    spawn(proxy, move || state(period, page));
}

pub(super) fn load_background(proxy: EventLoopProxy<UiEvent>, period: Period, page: u64) {
    thread::Builder::new()
        .name("clickpulse-leaderboard-refresh".into())
        .spawn(move || finish_background(proxy, state_background(period, page)))
        .ok();
}

pub(super) fn activity(proxy: EventLoopProxy<UiEvent>, member_id: String, days: u64) {
    thread::Builder::new()
        .name("clickpulse-leaderboard-activity".into())
        .spawn(move || {
            let result = (|| -> Result<Value> {
                let profile = leaderboard::load_profile()?
                    .context("Join the leaderboard to view activity")?;
                leaderboard::activity(&profile, &member_id, days)
            })();
            finish_activity(proxy, result);
        })
        .ok();
}

pub(super) fn set_visibility(proxy: EventLoopProxy<UiEvent>, visible: bool) {
    thread::Builder::new()
        .name("clickpulse-leaderboard-visibility".into())
        .spawn(move || {
            let result = (|| -> Result<Value> {
                let profile =
                    leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
                leaderboard::set_activity_visible(&profile, visible)?;
                Ok(json!({"activity_visible":visible}))
            })();
            finish_visibility(proxy, result);
        })
        .ok();
}

pub(super) fn join(
    proxy: EventLoopProxy<UiEvent>,
    invite_code: String,
    nickname: String,
    role: String,
) {
    spawn(proxy, move || {
        ensure!(
            leaderboard::load_profile()?.is_none(),
            "This installation has already joined the leaderboard"
        );
        let (profile, recovery_codes) = leaderboard::join(invite_code.trim(), nickname.trim(), role.trim())?;
        let profile_json = leaderboard::profile_summary(Some(&profile));
        let board = leaderboard::board(Some(&profile), Period::Today, 1)?;
        Ok(json!({
            "profile": profile_json,
            "recovery_codes": recovery_codes,
            "board": board
        }))
    });
}

pub(super) fn recover(proxy: EventLoopProxy<UiEvent>, recovery_code: String) {
    spawn(proxy, move || {
        ensure!(
            leaderboard::load_profile()?.is_none(),
            "Cannot recover: already joined"
        );
        let (profile, recovery_days) = leaderboard::recover(recovery_code.trim())?;
        let board = leaderboard::board(Some(&profile), Period::Today, 1)?;
        Ok(json!({
            "profile": leaderboard::profile_summary(Some(&profile)),
            "board": board,
            "skip_auto_sync": true,
            "recovery_stats": {
                "days": recovery_days
            }
        }))
    });
}

pub(super) fn recovery_codes(proxy: EventLoopProxy<UiEvent>) {
    spawn(proxy, move || {
        let profile =
            leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        let recovery_codes = leaderboard::regenerate_recovery_codes(&profile)?;
        Ok(json!({
            "profile": leaderboard::profile_summary(Some(&profile)),
            "recovery_codes": recovery_codes,
            "board": leaderboard::board(Some(&profile), Period::Today, 1)?
        }))
    });
}

pub(super) fn sync_snapshot(proxy: EventLoopProxy<UiEvent>, snapshot: String, period: Period) {
    spawn(proxy, move || {
        let profile =
            leaderboard::load_profile()?.context("Join the leaderboard before syncing")?;
        let value: Value = serde_json::from_str(&snapshot)?;
        let rows = value
            .get("history_days")
            .and_then(Value::as_array)
            .context("Statistics history is unavailable")?;
        let owned = rows
            .iter()
            .rev()
            .filter_map(|row| {
                let date = row
                    .get("day")
                    .and_then(Value::as_str)
                    .context("Invalid statistics date")
                    .ok()?;
                // Skip dates outside the server's allowed upload window
                if !leaderboard::allowed_upload_dates().contains(date) {
                    return None;
                }
                Some(row)
            })
            .take(8)
            .map(|row| {
                let date = row
                    .get("day")
                    .and_then(Value::as_str)
                    .context("Invalid statistics date")?
                    .to_owned();
                let counts = row.get("counts").context("Invalid statistics counts")?;
                let keyboard = counts
                    .get("keyboard")
                    .and_then(Value::as_i64)
                    .context("Invalid keyboard count")?;
                let mouse = counts
                    .get("mouse")
                    .and_then(Value::as_i64)
                    .context("Invalid mouse count")?;
                ensure!(keyboard >= 0 && mouse >= 0, "Statistics cannot be negative");
                Ok((date, keyboard, mouse))
            })
            .collect::<Result<Vec<_>>>()?;
        let days = owned
            .iter()
            .map(|(date, keyboard, mouse)| DailyCount {
                date,
                keyboard: *keyboard,
                mouse: *mouse,
            })
            .collect::<Vec<_>>();
        leaderboard::sync(&profile, &days)?;
        state(period, 1)
    });
}

pub(super) fn rename(proxy: EventLoopProxy<UiEvent>, nickname: String, period: Period) {
    spawn(proxy, move || {
        let mut profile =
            leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::rename(&mut profile, nickname.trim())?;
        state(period, 1)
    });
}

pub(super) fn set_role(proxy: EventLoopProxy<UiEvent>, role: String, period: Period) {
    spawn(proxy, move || {
        let mut profile =
            leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::set_role(&mut profile, role.trim())?;
        state(period, 1)
    });
}

pub(super) fn leave(proxy: EventLoopProxy<UiEvent>) {
    spawn(proxy, move || {
        let profile = leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::leave(&profile)?;
        Ok(json!({"profile":leaderboard::profile_summary(None),"board":null}))
    });
}

pub(super) fn upload_avatar(proxy: EventLoopProxy<UiEvent>, path: PathBuf, period: Period) {
    spawn(proxy, move || {
        let profile = leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        let bytes = leaderboard::prepare_avatar(&path)?;
        leaderboard::upload_avatar(&profile, &bytes)?;
        state(period, 1)
    });
}

pub(super) fn delete_avatar(proxy: EventLoopProxy<UiEvent>, period: Period) {
    spawn(proxy, move || {
        let profile = leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::delete_avatar(&profile)?;
        state(period, 1)
    });
}
