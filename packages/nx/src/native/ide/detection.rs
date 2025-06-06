use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SupportedEditor {
    VSCode,
    Cursor,
    Windsurf,
    JetBrains,
    Unknown,
}

static CURRENT_EDITOR: OnceLock<SupportedEditor> = OnceLock::new();

pub fn get_current_editor() -> &'static SupportedEditor {
    CURRENT_EDITOR.get_or_init(|| detect_editor(HashMap::new()))
}

pub fn detect_editor(mut env_map: HashMap<String, String>) -> SupportedEditor {
    let term_editor = if let Some(term) = get_env_var("TERM_PROGRAM", &mut env_map) {
        let term_lower = term.to_lowercase();
        match term_lower.as_str() {
            "vscode" => SupportedEditor::VSCode,
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

    if matches!(term_editor, SupportedEditor::VSCode) {
        if let Some(vscode_git_var) = get_env_var("VSCODE_GIT_ASKPASS_NODE", &mut env_map) {
            let vscode_git_var_lowercase = vscode_git_var.to_lowercase();
            if vscode_git_var_lowercase.contains("cursor") {
                return SupportedEditor::Cursor;
            } else if vscode_git_var_lowercase.contains("windsurf") {
                return SupportedEditor::Windsurf;
            } else {
                return SupportedEditor::VSCode;
            }
        } else {
            return term_editor;
        }
    }

    SupportedEditor::Unknown
}

fn get_env_var<'a>(name: &str, env_map: &'a mut HashMap<String, String>) -> Option<&'a str> {
    if env_map.contains_key(name) {
        return env_map.get(name).map(|s| s.as_str());
    }

    match std::env::var(name) {
        Ok(val) => {
            env_map.insert(name.to_string(), val);
            env_map.get(name).map(|s| s.as_str())
        }
        Err(_) => None,
    }
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
}
