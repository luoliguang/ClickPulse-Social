//! Explicit payloads reject unknown actions and incomplete or invalid options.
#[cfg(any(target_os = "windows", target_os = "linux"))]
use clickpulse::presentation::CloseAction;
use clickpulse::{
    localization::LanguagePreference,
    presentation::{ShareCardPreferences, Theme},
};
use serde::Deserialize;

fn default_page() -> u64 {
    1
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum Request {
    Language {
        language: LanguagePreference,
    },
    Timezone {
        timezone: clickpulse::timezone::TimeZonePreference,
    },
    Theme {
        theme: Theme,
    },
    SharePreferences {
        settings: ShareCardPreferences,
    },
    SaveShare {
        filename: String,
        png_base64: String,
    },
    CopyShare {
        png_base64: String,
    },
    CheckUpdates {},
    AutomaticUpdates {
        enabled: bool,
    },
    InstallUpdate {},
    DeferUpdate {
        version: String,
    },
    UpdateRelease {},
    Ready {},
    Compact {},
    Expand {},
    Drag {},
    Pin {},
    Hide {},
    Refresh {},
    SportSample {},
    Sport {
        enabled: bool,
    },
    SportVisible {
        visible: bool,
    },
    Leaderboard {
        period: clickpulse::leaderboard::Period,
        #[serde(default = "default_page")]
        page: u64,
        request_id: u64,
    },
    LeaderboardJoin {
        invite_code: String,
        nickname: String,
        role: String,
        request_id: u64,
    },
    LeaderboardRecover {
        recovery_code: String,
        request_id: u64,
    },
    LeaderboardRecoveryCodes {
        request_id: u64,
    },
    LeaderboardDevices {
        request_id: u64,
    },
    LeaderboardRevokeDevice {
        device_id: String,
        request_id: u64,
    },
    LeaderboardSync {
        period: clickpulse::leaderboard::Period,
        request_id: u64,
    },
    LeaderboardRename {
        nickname: String,
        period: clickpulse::leaderboard::Period,
        request_id: u64,
    },
    LeaderboardRole {
        role: String,
        period: clickpulse::leaderboard::Period,
        request_id: u64,
    },
    LeaderboardAvatar {
        period: clickpulse::leaderboard::Period,
        request_id: u64,
    },
    LeaderboardAvatarDelete {
        period: clickpulse::leaderboard::Period,
        request_id: u64,
    },
    LeaderboardLeave {
        request_id: u64,
    },
    LeaderboardActivity {
        member_id: String,
        days: Option<u64>,
        request_id: u64,
    },
    LeaderboardVisibility {
        visible: bool,
        request_id: u64,
    },
    Pause {},
    Permission {},
    Autostart {
        enabled: bool,
    },
    Reveal {},
    StorageDirectory {},
    ImportHistory {},
    Quit {},
    Close {},
    #[cfg(target_os = "macos")]
    Takeover {},
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    Minimize {},
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    Maximize {},
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    ClosePreference {
        close_action: CloseAction,
    },
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    CloseDecision {
        close_action: CloseAction,
        #[serde(default)]
        remember: bool,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_actions_and_payloads_are_rejected() {
        for body in [
            r#"{"action":"unknown"}"#,
            r#"{"action":"check_updates","url":"https://example.com"}"#,
            r#"{"action":"automatic_updates"}"#,
            r#"{"action":"automatic_updates","enabled":"true"}"#,
            r#"{"action":"automatic_updates","enabled":true,"interval":1}"#,
            r#"{"action":"install_update","path":"/tmp/other"}"#,
            r#"{"action":"defer_update"}"#,
            r#"{"action":"defer_update","version":"0.4.3","days":7}"#,
            r#"{"action":"update_release","url":"https://example.com"}"#,
            r#"{"action":"timezone","timezone":"not/a-zone"}"#,
            r#"{"action":"timezone"}"#,
            r#"{"action":"timezone","timezone":null}"#,
            r#"{"action":"export"}"#,
            r#"{"action":"theme"}"#,
            r#"{"action":"theme","theme":"unknown"}"#,
            r#"{"action":"share_preferences","settings":{"ratio":"wide"}}"#,
            r#"{"action":"save_share","filename":"card.png"}"#,
            r#"{"action":"copy_share","png_base64":7}"#,
            r#"{"action":"language","language":null}"#,
            r#"{"action":"language","language":"it"}"#,
            r#"{"action":"quit","theme":"blue"}"#,
            r#"{"action":"sport","enabled":"true"}"#,
            r#"{"action":"sport_skin","skin":"unknown"}"#,
            // Warp is the only Sport effect; there is no skin choice to send.
            r#"{"action":"sport_skin","skin":"warp"}"#,
            r#"{"action":"sport_sample","mouse":99999}"#,
            r#"{"action":"leaderboard","period":"lifetime"}"#,
            r#"{"action":"leaderboard","period":"today","page":-1}"#,
            r#"{"action":"leaderboard_activity","member_id":7}"#,
            r#"{"action":"leaderboard_visibility"}"#,
            r#"{"action":"leaderboard_visibility","visible":"true"}"#,
            r#"{"action":"leaderboard_join","invite_code":"x"}"#,
            r#"{"action":"leaderboard_sync","period":"today","keyboard":1}"#,
            r#"{"action":"leaderboard_leave","keep_data":true}"#,
            r#"{"action":"leaderboard_revoke_device"}"#,
            r#"{"action":"leaderboard_revoke_device","device_id":7}"#,
            r#"{"action":"leaderboard_devices","device_id":"x"}"#,
            r#"{"action":"autostart"}"#,
        ] {
            assert!(serde_json::from_str::<Request>(body).is_err(), "{body}");
        }
        assert!(matches!(
            serde_json::from_str::<Request>(r#"{"action":"theme","theme":"teal"}"#).unwrap(),
            Request::Theme { theme: Theme::Teal }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"share_preferences","settings":{"version":1,"template":"fingerprint","theme":"pink","ratio":"square","show_keyboard":true,"show_mouse":false,"show_peak":true,"show_qr":false,"show_brand":true,"privacy":true}}"#
            )
            .unwrap(),
            Request::SharePreferences { settings }
                if settings.theme == Theme::Pink && settings.privacy && !settings.show_qr
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"save_share","filename":"ClickPulse.png","png_base64":"AAAA"}"#
            )
            .unwrap(),
            Request::SaveShare { filename, png_base64 }
                if filename == "ClickPulse.png" && png_base64 == "AAAA"
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(r#"{"action":"copy_share","png_base64":"AAAA"}"#)
                .unwrap(),
            Request::CopyShare { png_base64 } if png_base64 == "AAAA"
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(r#"{"action":"language","language":"zh-CN"}"#).unwrap(),
            Request::Language {
                language: LanguagePreference::Chinese
            }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_join","invite_code":"CP_123456","nickname":"Luo","role":"developer","request_id":7}"#
            )
            .unwrap(),
            Request::LeaderboardJoin { invite_code, nickname, role, request_id }
                if invite_code == "CP_123456" && nickname == "Luo" && role == "developer" && request_id == 7
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_recover","recovery_code":"RC_abcd1234567890123456","request_id":8}"#
            )
            .unwrap(),
            Request::LeaderboardRecover { recovery_code, request_id }
                if recovery_code == "RC_abcd1234567890123456" && request_id == 8
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_sync","period":"week","request_id":9}"#
            )
            .unwrap(),
            Request::LeaderboardSync {
                period: clickpulse::leaderboard::Period::Week,
                request_id: 9,
            }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard","period":"today","request_id":10}"#
            )
            .unwrap(),
            Request::Leaderboard {
                period: clickpulse::leaderboard::Period::Today,
                page: 1,
                request_id: 10
            }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard","period":"week","page":3,"request_id":11}"#
            )
            .unwrap(),
            Request::Leaderboard {
                period: clickpulse::leaderboard::Period::Week,
                page: 3,
                request_id: 11
            }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_activity","member_id":"m1","days":30,"request_id":7}"#
            )
            .unwrap(),
            Request::LeaderboardActivity {
                member_id,
                days,
                request_id,
            } if member_id == "m1" && days == Some(30) && request_id == 7
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_visibility","visible":true,"request_id":12}"#
            )
            .unwrap(),
            Request::LeaderboardVisibility {
                visible: true,
                request_id: 12
            }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(r#"{"action":"leaderboard_devices","request_id":13}"#)
                .unwrap(),
            Request::LeaderboardDevices { request_id: 13 }
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"leaderboard_revoke_device","device_id":"dev-1","request_id":14}"#
            )
            .unwrap(),
            Request::LeaderboardRevokeDevice { device_id, request_id } if device_id == "dev-1" && request_id == 14
        ));
        assert!(matches!(
            serde_json::from_str::<Request>(
                r#"{"action":"defer_update","version":"0.4.3"}"#
            )
            .unwrap(),
            Request::DeferUpdate { version } if version == "0.4.3"
        ));
    }

    #[test]
    fn timezone_payload_uses_validated_iana_names() {
        for name in ["system", "Asia/Shanghai", "America/Los_Angeles"] {
            let body = serde_json::json!({"action":"timezone","timezone":name}).to_string();
            assert!(matches!(
                serde_json::from_str::<Request>(&body).unwrap(),
                Request::Timezone { .. }
            ));
        }
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn close_choices_require_a_known_choice_and_boolean_remember_flag() {
        assert!(matches!(
            serde_json::from_str::<Request>(r#"{"action":"close_decision","close_action":"hide"}"#)
                .unwrap(),
            Request::CloseDecision {
                close_action: CloseAction::Hide,
                remember: false
            }
        ));
        assert!(
            serde_json::from_str::<Request>(
                r#"{"action":"close_decision","close_action":"quit","remember":"true"}"#
            )
            .is_err()
        );
    }
}
