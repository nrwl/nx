use std::env;
use std::fs;
use std::path::PathBuf;

const CONFIG_DIR: &str = "nxcloud";
const CONFIG_FILE: &str = "nxcloud.ini";

/// The personal access token `nx-cloud login` stored for `api_url`, mirroring
/// the client bundle's `NxCloudGlobalConfig` lookup order.
pub fn personal_access_token(api_url: &str) -> Option<String> {
    let path = existing_config_path()?;
    let contents = fs::read_to_string(path).ok()?;
    let wanted = api_url.trim_end_matches('/');
    parse_ini_token(&contents, wanted)
}

fn existing_config_path() -> Option<PathBuf> {
    candidate_paths().into_iter().find(|path| path.is_file())
}

fn candidate_paths() -> Vec<PathBuf> {
    let home = env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from);
    let mut candidates = Vec::new();
    if cfg!(windows) {
        if let Some(home) = &home {
            candidates.push(home.join(format!(".{CONFIG_FILE}")));
        }
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            candidates.push(PathBuf::from(local).join(CONFIG_DIR).join(CONFIG_FILE));
        }
        return candidates;
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME") {
        candidates.push(PathBuf::from(xdg).join(CONFIG_DIR).join(CONFIG_FILE));
    }
    if let Some(home) = &home {
        candidates.push(home.join(format!(".{CONFIG_FILE}")));
        candidates.push(home.join(".config").join(CONFIG_DIR).join(CONFIG_FILE));
    }
    candidates
}

// The file is written by the `ini` npm package: section names are the Nx Cloud
// URL with dots escaped as `\.`, values may be JSON-quoted.
fn parse_ini_token(contents: &str, api_url: &str) -> Option<String> {
    let mut in_section = false;
    for raw in contents.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if let Some(section) = line.strip_prefix('[').and_then(|l| l.strip_suffix(']')) {
            let name = unquote(section).replace("\\.", ".");
            in_section = name.trim_end_matches('/') == api_url;
            continue;
        }
        if !in_section {
            continue;
        }
        let (key, value) = line.split_once('=')?;
        if key.trim() == "personalAccessToken" {
            let token = unquote(value.trim());
            return (!token.is_empty()).then_some(token);
        }
    }
    None
}

fn unquote(value: &str) -> String {
    if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
        serde_json::from_str::<String>(value)
            .unwrap_or_else(|_| value[1..value.len() - 1].to_string())
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_token_for_matching_url() {
        let ini = "[https://cloud\\.nx\\.app]\npersonalAccessToken=abc\n\n[https://x\\.example\\.com/]\npersonalAccessToken=\"d=e\"\n";
        assert_eq!(
            parse_ini_token(ini, "https://cloud.nx.app"),
            Some("abc".into())
        );
        assert_eq!(
            parse_ini_token(ini, "https://x.example.com"),
            Some("d=e".into())
        );
        assert_eq!(parse_ini_token(ini, "https://other.example.com"), None);
    }
}
