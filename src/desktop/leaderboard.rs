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

fn spawn(proxy: EventLoopProxy<UiEvent>, task: impl FnOnce() -> Result<Value> + Send + 'static) {
    thread::Builder::new()
        .name("clickpulse-leaderboard".into())
        .spawn(move || finish(proxy, task()))
        .ok();
}

fn state(period: Period) -> Result<Value> {
    let profile = leaderboard::load_profile()?;
    let board = match &profile {
        Some(profile) => Some(leaderboard::board(Some(profile), period)?),
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
        ("m1", "Lin", 24_820, 5_416, "#7c3aed"),
        ("demo", "罗洋洋", 21_460, 4_982, "#2563eb"),
        ("m3", "Mika", 18_305, 3_744, "#0f766e"),
        ("m4", "Alex", 15_920, 4_101, "#c2410c"),
        ("m5", "小北", 12_638, 2_877, "#be123c"),
    ].into_iter().enumerate().map(|(index, (id, nickname, keyboard, mouse, color))| json!({
        "rank":index + 1,"member_id":id,"nickname":nickname,
        "avatar":{"url":null,"initial":nickname.chars().next().unwrap_or('?').to_string(),"color":color},
        "keyboard":keyboard,"mouse":mouse,"total":keyboard + mouse,"is_self":id == "demo"
    })).collect::<Vec<_>>();
    json!({
        "profile":{"joined":true,"member_id":"demo","nickname":"罗洋洋","demo":true},
        "board":{"period":period_name,"starts_on":"2026-11-10","ends_on":"2026-11-16","entries":entries,"self_rank":2}
    })
}

pub(super) fn load(proxy: EventLoopProxy<UiEvent>, period: Period) {
    spawn(proxy, move || state(period));
}

pub(super) fn join(proxy: EventLoopProxy<UiEvent>, invite_code: String, nickname: String) {
    spawn(proxy, move || {
        ensure!(
            leaderboard::load_profile()?.is_none(),
            "This installation has already joined the leaderboard"
        );
        leaderboard::join(invite_code.trim(), nickname.trim())?;
        state(Period::Today)
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
        state(period)
    });
}

pub(super) fn rename(proxy: EventLoopProxy<UiEvent>, nickname: String, period: Period) {
    spawn(proxy, move || {
        let mut profile =
            leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::rename(&mut profile, nickname.trim())?;
        state(period)
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
        state(period)
    });
}

pub(super) fn delete_avatar(proxy: EventLoopProxy<UiEvent>, period: Period) {
    spawn(proxy, move || {
        let profile = leaderboard::load_profile()?.context("Leaderboard membership is missing")?;
        leaderboard::delete_avatar(&profile)?;
        state(period)
    });
}
