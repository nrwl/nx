use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SupportedEditor {
    VSCode,
    VSCodeInsiders,
    Cursor,
    Windsurf,
    JetBrains,
    Unknown,
}

static CURRENT_EDITOR: OnceLock<SupportedEditor> = OnceLock::new();

pub fn get_current_editor() -> &'static SupportedEditor {
    CURRENT_EDITOR.get_or_init(|| {
        let env_map: HashMap<String, String> = std::env::vars().collect();
        detect_editor(env_map)
    })
}

fn detect_editor(env_map: HashMap<String, String>) -> SupportedEditor {
    // Check for Cursor-specific environment variable first
    if get_env_var("CURSOR_TRACE_ID", &env_map).is_some() {
        return SupportedEditor::Cursor;
    }

    let term_editor = if let Some(term) = get_env_var("TERM_PROGRAM", &env_map) {
        let term_lower = term.to_lowercase();
        match term_lower.as_str() {
            "vscode" => {
                // Check if it's VS Code Insiders by looking at TERM_PROGRAM_VERSION
                if let Some(version) = get_env_var("TERM_PROGRAM_VERSION", &env_map) {
                    if version.contains("-insider") {
                        SupportedEditor::VSCodeInsiders
                    } else {
                        SupportedEditor::VSCode
                    }
                } else {
                    SupportedEditor::VSCode
                }
            }
            "cursor" => SupportedEditor::Cursor,
            "windsurf" => SupportedEditor::Windsurf,
            "jetbrains" => SupportedEditor::JetBrains,
            _ => SupportedEditor::Unknown,
        }
    } else {
        SupportedEditor::Unknown
    };

    // For JetBrains, we don't need any additional checks
    if matches!(term_editor, SupportedEditor::JetBrains) {
        return term_editor;
    }

    if matches!(
        term_editor,
        SupportedEditor::VSCode | SupportedEditor::VSCodeInsiders
    ) {
        if let Some(vscode_git_var) = get_env_var("VSCODE_GIT_ASKPASS", &env_map) {
            let vscode_git_var_lowercase = vscode_git_var.to_lowercase();
            if vscode_git_var_lowercase.contains("cursor") {
                return SupportedEditor::Cursor;
            } else if vscode_git_var_lowercase.contains("windsurf") {
                return SupportedEditor::Windsurf;
            } else {
                return term_editor;
            }
        } else {
            return term_editor;
        }
    }

    SupportedEditor::Unknown
}

fn get_env_var<'a>(name: &str, env_map: &'a HashMap<String, String>) -> Option<&'a str> {
    env_map.get(name).map(|s| s.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_detect_vscode() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/vscode/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCode);
    }

    #[test]
    fn test_detect_vscode_with_regular_version() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert("TERM_PROGRAM_VERSION".to_string(), "1.104.0".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/vscode-insiders/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCode);
    }

    #[test]
    fn test_detect_vscode_insiders() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "TERM_PROGRAM_VERSION".to_string(),
            "1.104.0-insider".to_string(),
        );
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/vscode/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCodeInsiders);
    }

    #[test]
    fn test_detect_cursor() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/cursor/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::Cursor);
    }

    #[test]
    fn test_detect_windsurf() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/windsurf/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::Windsurf);
    }

    #[test]
    fn test_detect_jetbrains() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "jetbrains".to_string());
        assert_eq!(detect_editor(test_env), SupportedEditor::JetBrains);
    }

    #[test]
    fn test_term_program_unknown() {
        let mut test_env = HashMap::new();
        test_env.insert(
            "TERM_PROGRAM".to_string(),
            "some-unknown-editor".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::Unknown);
    }

    #[test]
    fn test_vscode_without_askpass_confirmation() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/vscode/in/it".to_string(),
        );
        // No VSCODE_GIT_ASKPASS_NODE set or doesn't contain "vscode"
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCode);
    }

    #[test]
    fn test_vscode_with_wrong_askpass() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/no/matching/editor".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCode);
    }

    #[test]
    fn test_case_insensitivity() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "VSCode".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/VSCODE/in/it".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCode);
    }

    #[test]
    fn test_vscode_insiders_without_askpass() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "vscode".to_string());
        test_env.insert(
            "TERM_PROGRAM_VERSION".to_string(),
            "1.104.0-insider".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::VSCodeInsiders);
    }

    #[test]
    fn test_cursor_without_askpass_confirmation() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "cursor".to_string());
        // No VSCODE_GIT_ASKPASS_NODE set
        assert_eq!(detect_editor(test_env), SupportedEditor::Unknown);
    }

    #[test]
    fn test_cursor_with_wrong_askpass() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "cursor".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/no/matching/editor".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::Unknown);
    }

    #[test]
    fn test_windsurf_without_askpass_confirmation() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "windsurf".to_string());
        // No VSCODE_GIT_ASKPASS_NODE set
        assert_eq!(detect_editor(test_env), SupportedEditor::Unknown);
    }

    #[test]
    fn test_windsurf_with_wrong_askpass() {
        let mut test_env = HashMap::new();
        test_env.insert("TERM_PROGRAM".to_string(), "windsurf".to_string());
        test_env.insert(
            "VSCODE_GIT_ASKPASS_NODE".to_string(),
            "some/path/with/no/matching/editor".to_string(),
        );
        assert_eq!(detect_editor(test_env), SupportedEditor::Unknown);
    }

    #[test]
    fn test_detect_cursor_via_trace_id() {
        let mut test_env = HashMap::new();
        test_env.insert("CURSOR_TRACE_ID".to_string(), "test-trace-id".to_string());
        assert_eq!(detect_editor(test_env), SupportedEditor::Cursor);
    }
}
