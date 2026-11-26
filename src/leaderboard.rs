//! Opt-in leaderboard client. Local activity remains private until a member joins.
use anyhow::{Context, Result, bail, ensure};
use chrono::{TimeZone, Utc};
use chrono_tz::Asia::Shanghai;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
    collections::HashSet,
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};

pub const API_BASE: &str = "https://clickpulse.fangdutex.cn/api/v1";
const MAX_RESPONSE: u64 = 1024 * 1024;
const MAX_AVATAR: usize = 200 * 1024;

pub const ROLES: &[&str] = &[
    "developer",
    "designer",
    "product_manager",
    "operations",
    "marketing",
    "data",
    "engineer",
    "researcher",
    "teacher",
    "writer",
    "student",
    "office",
    "finance",
    "sales",
    "hr",
    "customer_support",
    "legal",
    "medical",
    "freelancer",
    "other",
];

fn default_role() -> String {
    "other".to_owned()
}

fn normalize_role(role: &str) -> Result<String> {
    let role = role.trim();
    if role.is_empty() {
        return Ok(default_role());
    }
    ensure!(ROLES.contains(&role), "Leaderboard role is invalid");
    Ok(role.to_owned())
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    pub member_id: String,
    pub nickname: String,
    #[serde(default = "default_role")]
    pub role: String,
    pub token: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Period {
    Today,
    Week,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Avatar {
    pub url: Option<String>,
    pub initial: String,
    pub color: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Entry {
    pub rank: u64,
    pub member_id: String,
    pub nickname: String,
    #[serde(default = "default_role")]
    pub role: String,
    pub avatar: Avatar,
    pub keyboard: i64,
    pub mouse: i64,
    pub total: i64,
    #[serde(default)]
    pub is_self: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Board {
    pub period: Period,
    pub starts_on: String,
    pub ends_on: String,
    pub entries: Vec<Entry>,
    pub self_rank: Option<u64>,
    #[serde(default)]
    pub page: u64,
    #[serde(default)]
    pub page_size: u64,
    #[serde(default)]
    pub total_entries: u64,
    #[serde(default)]
    pub total_pages: u64,
    #[serde(default)]
    pub self_entry: Option<Entry>,
}

#[derive(Clone, Debug, Deserialize)]
struct Me {
    activity_visible: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
struct JoinResponse {
    member: Member,
    token: String,
    #[serde(default)]
    recovery_codes: Vec<String>,
    #[serde(default)]
    recovery_stats: RecoveryStats,
}

#[derive(Clone, Debug, Default, Deserialize)]
struct RecoveryStats {
    days: Vec<RecoveryDay>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RecoveryDay {
    pub day: String,
    pub keyboard: i64,
    pub mouse: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_seen_at: String,
    #[serde(default)]
    pub current: bool,
}

#[derive(Clone, Debug, Deserialize)]
struct DevicesResponse {
    devices: Vec<Device>,
}

#[derive(Clone, Debug, Deserialize)]
struct RecoveryCodesResponse {
    recovery_codes: Vec<String>,
}
#[derive(Clone, Debug, Deserialize)]
struct Member {
    id: String,
    nickname: String,
    #[serde(default = "default_role")]
    role: String,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct DailyCount<'a> {
    pub date: &'a str,
    pub keyboard: i64,
    pub mouse: i64,
}

/// Returns the set of dates (YYYY-MM-DD) the server accepts for stat uploads.
/// Server only accepts the most recent 8 calendar days in Asia/Shanghai timezone.
pub fn allowed_upload_dates() -> HashSet<String> {
    let now = Utc::now();
    (0..8)
        .map(|days_ago| {
            let shifted = now - chrono::Duration::days(days_ago);
            Shanghai
                .from_utc_datetime(&shifted.naive_utc())
                .format("%Y-%m-%d")
                .to_string()
        })
        .collect()
}

fn profile_path() -> Result<PathBuf> {
    Ok(crate::platform::data_dir()?.join("leaderboard.json"))
}

pub fn load_profile() -> Result<Option<Profile>> {
    let path = profile_path()?;
    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error).context("Unable to read leaderboard membership"),
    };
    Ok(Some(
        serde_json::from_slice(&bytes).context("Invalid leaderboard membership")?,
    ))
}

fn save_profile(profile: &Profile) -> Result<()> {
    let path = profile_path()?;
    let parent = path.parent().context("Invalid leaderboard profile path")?;
    std::fs::create_dir_all(parent)?;
    let staged = path.with_extension(format!("{}.tmp", std::process::id()));
    let result = (|| {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.create(true).truncate(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&staged)?;
        file.write_all(&serde_json::to_vec_pretty(profile)?)?;
        file.sync_all()?;
        std::fs::rename(&staged, &path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(staged);
    }
    result
}

fn clear_profile() -> Result<()> {
    match std::fs::remove_file(profile_path()?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .https_only(true)
        .timeout_global(Some(Duration::from_secs(30)))
        .timeout_connect(Some(Duration::from_secs(10)))
        .timeout_per_read(Some(Duration::from_secs(20)))
        .user_agent(format!(
            "ClickPulse/{} ({})",
            crate::version::PUBLIC,
            crate::platform::name()
        ))
        .build()
        .into()
}

fn read_json<T: DeserializeOwned>(mut response: ureq::http::Response<ureq::Body>) -> Result<T> {
    let mut bytes = Vec::new();
    response
        .body_mut()
        .as_reader()
        .take(MAX_RESPONSE + 1)
        .read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= MAX_RESPONSE,
        "Leaderboard response is too large"
    );
    serde_json::from_slice(&bytes).context("Invalid leaderboard response")
}

fn json_request<T: Serialize, R: DeserializeOwned>(
    method: &str,
    path: &str,
    body: &T,
    profile: Option<&Profile>,
) -> Result<R> {
    let client = agent();
    let url = format!("{API_BASE}{path}");
    let token = profile.map(|profile| format!("Bearer {}", profile.token));
    let bytes = serde_json::to_vec(body)?;
    let response = match method {
        "POST" => {
            let mut request = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
            if let Some(token) = &token {
                request = request.header("Authorization", token);
            }
            request
                .config()
                .http_status_as_error(false)
                .build()
                .send(&bytes)?
        }
        "PUT" => {
            let mut request = client
                .put(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
            if let Some(token) = &token {
                request = request.header("Authorization", token);
            }
            request
                .config()
                .http_status_as_error(false)
                .build()
                .send(&bytes)?
        }
        "PATCH" => {
            let mut request = client
                .patch(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
            if let Some(token) = &token {
                request = request.header("Authorization", token);
            }
            request
                .config()
                .http_status_as_error(false)
                .build()
                .send(&bytes)?
        }
        _ => unreachable!("unsupported JSON method"),
    };
    let status = response.status().as_u16();
    if status >= 400 {
        let value: serde_json::Value = read_json(response)?;
        let code = value
            .pointer("/error/code")
            .and_then(|value| value.as_str())
            .unwrap_or("unknown");
        bail!("leaderboard_server_{code}");
    }
    read_json(response)
}

pub fn join(invite_code: &str, nickname: &str, role: &str) -> Result<(Profile, Vec<String>)> {
    #[derive(Serialize)]
    struct Join<'a> {
        invite_code: &'a str,
        nickname: &'a str,
        role: &'a str,
    }
    let role = normalize_role(role)?;
    let response: JoinResponse = json_request(
        "POST",
        "/join",
        &Join {
            invite_code,
            nickname,
            role: &role,
        },
        None,
    )?;
    let profile = Profile {
        member_id: response.member.id,
        nickname: response.member.nickname,
        role: response.member.role,
        token: response.token,
    };
    save_profile(&profile)?;
    Ok((profile, response.recovery_codes))
}

pub fn recover(recovery_code: &str) -> Result<(Profile, Vec<RecoveryDay>)> {
    #[derive(Serialize)]
    struct Recover<'a> {
        recovery_code: &'a str,
    }
    let response: JoinResponse = json_request(
        "POST",
        "/recover",
        &Recover {
            recovery_code: recovery_code.trim(),
        },
        None,
    )?;
    let profile = Profile {
        member_id: response.member.id,
        nickname: response.member.nickname,
        role: response.member.role,
        token: response.token,
    };
    save_profile(&profile)?;
    Ok((profile, response.recovery_stats.days))
}

pub fn regenerate_recovery_codes(profile: &Profile) -> Result<Vec<String>> {
    let response: RecoveryCodesResponse = json_request(
        "POST",
        "/recovery-codes",
        &serde_json::json!({}),
        Some(profile),
    )?;
    Ok(response.recovery_codes)
}

pub fn sync(profile: &Profile, days: &[DailyCount<'_>]) -> Result<()> {
    #[derive(Serialize)]
    struct Payload<'a> {
        days: &'a [DailyCount<'a>],
    }
    let _: serde_json::Value = json_request("PUT", "/stats", &Payload { days }, Some(profile))?;
    Ok(())
}

fn board_url(period: Period, page: u64) -> String {
    let period = match period {
        Period::Today => "today",
        Period::Week => "week",
    };
    if page <= 1 {
        // Older deployed APIs reject unknown query parameters. Omitting page=1 keeps
        // the first page usable while the server and desktop app roll out separately.
        format!("{API_BASE}/leaderboard?period={period}")
    } else {
        format!("{API_BASE}/leaderboard?period={period}&page={page}")
    }
}

pub fn board(profile: Option<&Profile>, period: Period, page: u64) -> Result<Board> {
    let client = agent();
    let mut request = client
        .get(board_url(period, page))
        .header("Accept", "application/json");
    if let Some(profile) = profile {
        request = request.header("Authorization", &format!("Bearer {}", profile.token));
    }
    read_json(request.call()?)
}

pub fn me(profile: &Profile) -> Result<Option<bool>> {
    let client = agent();
    let response = client
        .get(format!("{API_BASE}/me"))
        .header("Accept", "application/json")
        .header("Authorization", &format!("Bearer {}", profile.token))
        .call()?;
    let member: Me = read_json(response)?;
    Ok(member.activity_visible)
}

pub fn activity(profile: &Profile, member_id: &str, days: u64) -> Result<serde_json::Value> {
    let client = agent();
    let response = client
        .get(format!(
            "{API_BASE}/members/{member_id}/activity?days={days}"
        ))
        .header("Accept", "application/json")
        .header("Authorization", &format!("Bearer {}", profile.token))
        .config()
        .http_status_as_error(false)
        .build()
        .call()?;
    let status = response.status().as_u16();
    let value: serde_json::Value = read_json(response)?;
    if status >= 400 {
        let code = value
            .pointer("/error/code")
            .and_then(|code| code.as_str())
            .unwrap_or("unknown");
        let message = value
            .pointer("/error/message")
            .and_then(|message| message.as_str())
            .unwrap_or("Unable to load activity");
        if code == "activity_private" || code == "not_found" {
            bail!("{code}");
        }
        bail!("{message}");
    }
    Ok(value)
}

pub fn set_activity_visible(profile: &Profile, visible: bool) -> Result<()> {
    #[derive(Serialize)]
    struct Visibility {
        activity_visible: bool,
    }
    let _: serde_json::Value = json_request(
        "PATCH",
        "/me",
        &Visibility {
            activity_visible: visible,
        },
        Some(profile),
    )?;
    Ok(())
}

pub fn devices(profile: &Profile) -> Result<Vec<Device>> {
    let client = agent();
    let response = client
        .get(format!("{API_BASE}/devices"))
        .header("Accept", "application/json")
        .header("Authorization", &format!("Bearer {}", profile.token))
        .config()
        .http_status_as_error(false)
        .build()
        .call()?;
    let status = response.status().as_u16();
    let value: serde_json::Value = read_json(response)?;
    if status >= 400 {
        let code = value
            .pointer("/error/code")
            .and_then(|code| code.as_str())
            .unwrap_or("unknown");
        bail!("leaderboard_server_{code}");
    }
    let response: DevicesResponse =
        serde_json::from_value(value).context("Invalid leaderboard response")?;
    Ok(response.devices)
}

pub fn revoke_device(profile: &Profile, device_id: &str) -> Result<()> {
    let client = agent();
    let response = client
        .delete(format!("{API_BASE}/devices/{}", device_id.trim()))
        .header("Accept", "application/json")
        .header("Authorization", &format!("Bearer {}", profile.token))
        .config()
        .http_status_as_error(false)
        .build()
        .call()?;
    let status = response.status().as_u16();
    let value: serde_json::Value = read_json(response)?;
    if status >= 400 {
        let code = value
            .pointer("/error/code")
            .and_then(|code| code.as_str())
            .unwrap_or("unknown");
        bail!("leaderboard_server_{code}");
    }
    Ok(())
}

pub fn rename(profile: &mut Profile, nickname: &str) -> Result<()> {
    #[derive(Serialize)]
    struct Rename<'a> {
        nickname: &'a str,
    }
    let member: Member = json_request("PATCH", "/me", &Rename { nickname }, Some(profile))?;
    profile.nickname = member.nickname;
    save_profile(profile)
}

pub fn set_role(profile: &mut Profile, role: &str) -> Result<()> {
    #[derive(Serialize)]
    struct Role<'a> {
        role: &'a str,
    }
    let role = normalize_role(role)?;
    let member: Member = json_request("PATCH", "/me", &Role { role: &role }, Some(profile))?;
    profile.role = member.role;
    save_profile(profile)
}

pub fn leave(profile: &Profile) -> Result<()> {
    let client = agent();
    let response = client
        .delete(format!("{API_BASE}/me"))
        .header("Authorization", &format!("Bearer {}", profile.token))
        .call()?;
    let _: serde_json::Value = read_json(response)?;
    clear_profile()
}

pub fn delete_avatar(profile: &Profile) -> Result<()> {
    let client = agent();
    let response = client
        .delete(format!("{API_BASE}/avatar"))
        .header("Authorization", &format!("Bearer {}", profile.token))
        .call()?;
    let _: serde_json::Value = read_json(response)?;
    Ok(())
}

pub fn prepare_avatar(path: &Path) -> Result<Vec<u8>> {
    let input = std::fs::read(path).context("Unable to read avatar")?;
    ensure!(
        input.len() <= 10 * 1024 * 1024,
        "Avatar source is too large"
    );
    let image = image::load_from_memory(&input).context("Unsupported avatar image")?;
    ensure!(
        image.width() >= 32 && image.height() >= 32,
        "Avatar is too small"
    );
    let side = image.width().min(image.height());
    let x = (image.width() - side) / 2;
    let y = (image.height() - side) / 2;
    let square = image.crop_imm(x, y, side, side);
    for size in [256, 224, 192] {
        let resized = square
            .resize_exact(size, size, image::imageops::FilterType::Lanczos3)
            .to_rgba8();
        let mut output = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut output).encode(
            &resized,
            size,
            size,
            image::ExtendedColorType::Rgba8,
        )?;
        if output.len() <= MAX_AVATAR {
            return Ok(output);
        }
    }
    anyhow::bail!("Processed avatar is too large")
}

pub fn upload_avatar(profile: &Profile, bytes: &[u8]) -> Result<()> {
    ensure!(bytes.len() <= MAX_AVATAR, "Avatar is too large");
    ensure!(
        bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        "Invalid avatar format"
    );
    let client = agent();
    let response = client
        .post(format!("{API_BASE}/avatar"))
        .header("Authorization", &format!("Bearer {}", profile.token))
        .header("Content-Type", "image/webp")
        .send(bytes)?;
    let _: serde_json::Value = read_json(response)?;
    Ok(())
}

pub fn profile_summary(profile: Option<&Profile>) -> serde_json::Value {
    match profile {
        Some(profile) => {
            serde_json::json!({"joined":true,"member_id":profile.member_id,"nickname":profile.nickname,"role":profile.role})
        }
        None => serde_json::json!({"joined":false}),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profile_summary_never_exposes_token() {
        let value = profile_summary(Some(&Profile {
            member_id: "m1".into(),
            nickname: "Luo".into(),
            role: "developer".into(),
            token: "secret".into(),
        }));
        assert_eq!(value["nickname"], "Luo");
        assert_eq!(value["role"], "developer");
        assert!(value.get("token").is_none());
    }
    #[test]
    fn role_normalization_falls_back_to_other_and_rejects_unknown_values() {
        assert_eq!(normalize_role("  ").unwrap(), "other");
        assert_eq!(normalize_role("developer").unwrap(), "developer");
        assert!(normalize_role("astronaut").is_err());
    }
    #[test]
    fn avatar_processing_strips_input_and_produces_bounded_webp() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("avatar.png");
        let image = image::RgbaImage::from_pixel(320, 200, image::Rgba([40, 80, 120, 255]));
        image.save(&path).unwrap();
        let output = prepare_avatar(&path).unwrap();
        assert!(output.len() <= MAX_AVATAR);
        assert_eq!(&output[..4], b"RIFF");
        assert_eq!(&output[8..12], b"WEBP");
    }
    #[test]
    fn first_page_url_remains_compatible_with_the_legacy_server() {
        assert_eq!(
            board_url(Period::Today, 1),
            format!("{API_BASE}/leaderboard?period=today")
        );
        assert_eq!(
            board_url(Period::Week, 2),
            format!("{API_BASE}/leaderboard?period=week&page=2")
        );
    }
    #[test]
    fn board_tolerates_legacy_payloads_and_reads_pagination_metadata() {
        let legacy: Board = serde_json::from_str(
            r#"{"period":"week","starts_on":"2026-11-16","ends_on":"2026-11-22","entries":[],"self_rank":null}"#,
        )
        .unwrap();
        assert_eq!(legacy.page, 0);
        assert_eq!(legacy.total_pages, 0);
        assert!(legacy.self_entry.is_none());
        let paged: Board = serde_json::from_str(
            r##"{"period":"today","starts_on":"2026-11-22","ends_on":"2026-11-22","entries":[],"self_rank":3,"page":1,"page_size":20,"total_entries":57,"total_pages":3,"self_entry":{"rank":3,"member_id":"m1","nickname":"Luo","role":"developer","avatar":{"url":null,"initial":"L","color":"#2563eb"},"keyboard":10,"mouse":2,"total":12,"is_self":true}}"##,
        )
        .unwrap();
        assert_eq!(paged.page_size, 20);
        assert_eq!(paged.total_entries, 57);
        assert_eq!(paged.self_entry.unwrap().rank, 3);
    }
    #[test]
    fn legacy_member_payload_does_not_claim_activity_support() {
        let legacy: Me = serde_json::from_str(r#"{"id":"m1"}"#).unwrap();
        let current: Me = serde_json::from_str(r#"{"activity_visible":false}"#).unwrap();
        assert_eq!(legacy.activity_visible, None);
        assert_eq!(current.activity_visible, Some(false));
    }
}
