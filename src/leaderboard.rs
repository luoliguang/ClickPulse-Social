//! Opt-in leaderboard client. Local activity remains private until a member joins.
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
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
}

#[derive(Clone, Debug, Deserialize)]
struct JoinResponse {
    member: Member,
    token: String,
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
        .user_agent(format!("ClickPulse/{}", crate::version::PUBLIC))
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
            request.send(&bytes)?
        }
        "PUT" => {
            let mut request = client
                .put(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
            if let Some(token) = &token {
                request = request.header("Authorization", token);
            }
            request.send(&bytes)?
        }
        "PATCH" => {
            let mut request = client
                .patch(&url)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json");
            if let Some(token) = &token {
                request = request.header("Authorization", token);
            }
            request.send(&bytes)?
        }
        _ => unreachable!("unsupported JSON method"),
    };
    read_json(response)
}

pub fn join(invite_code: &str, nickname: &str, role: &str) -> Result<Profile> {
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
    Ok(profile)
}

pub fn sync(profile: &Profile, days: &[DailyCount<'_>]) -> Result<()> {
    #[derive(Serialize)]
    struct Payload<'a> {
        days: &'a [DailyCount<'a>],
    }
    let _: serde_json::Value = json_request("PUT", "/stats", &Payload { days }, Some(profile))?;
    Ok(())
}

pub fn board(profile: Option<&Profile>, period: Period) -> Result<Board> {
    let period = match period {
        Period::Today => "today",
        Period::Week => "week",
    };
    let client = agent();
    let mut request = client
        .get(format!("{API_BASE}/leaderboard?period={period}"))
        .header("Accept", "application/json");
    if let Some(profile) = profile {
        request = request.header("Authorization", &format!("Bearer {}", profile.token));
    }
    read_json(request.call()?)
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
}
