use std::collections::HashMap;
use tracing::debug;

fn has_var(env_vars: &HashMap<String, String>, key: &str) -> bool {
    env_vars.contains_key(key)
}

fn get_var(env_vars: &HashMap<String, String>, key: &str) -> Option<String> {
    env_vars.get(key).cloned()
}

/// Detects if the current process is being run by Claude Code
fn is_claude_ai(env_vars: &HashMap<String, String>) -> bool {
    if has_var(env_vars, "CLAUDECODE") {
        debug!("Claude AI detected via CLAUDECODE environment variable");
        return true;
    }
    if has_var(env_vars, "CLAUDE_CODE") {
        debug!("Claude AI detected via CLAUDE_CODE environment variable");
        return true;
    }
    false
}

/// Detects if the current process is being run by Repl.it
fn is_replit_ai(env_vars: &HashMap<String, String>) -> bool {
    if has_var(env_vars, "REPL_ID") {
        debug!("Repl.it AI detected via REPL_ID environment variable");
        return true;
    }
    false
}

/// Detects if the current process is being run by Cursor AI
fn is_cursor_ai(env_vars: &HashMap<String, String>) -> bool {
    let pager_matches = get_var(env_vars, "PAGER")
        .map(|v| v == "head -n 10000 | cat")
        .unwrap_or(false);
    let has_cursor_trace_id = has_var(env_vars, "CURSOR_TRACE_ID");
    let has_composer_no_interaction = has_var(env_vars, "COMPOSER_NO_INTERACTION");

    let is_cursor = pager_matches && has_cursor_trace_id && has_composer_no_interaction;

    if is_cursor {
        debug!(
            "Cursor AI detected via PAGER, CURSOR_TRACE_ID, and COMPOSER_NO_INTERACTION environment variables"
        );
    }

    is_cursor
}

/// Detects if the current process is being run by OpenCode
fn is_opencode_ai(env_vars: &HashMap<String, String>) -> bool {
    if has_var(env_vars, "OPENCODE") {
        debug!("OpenCode AI detected via OPENCODE environment variable");
        return true;
    }
    false
}

/// Detects if the current process is being run by Gemini CLI
fn is_gemini_ai(env_vars: &HashMap<String, String>) -> bool {
    if has_var(env_vars, "GEMINI_CLI") {
        debug!("Gemini CLI detected via GEMINI_CLI environment variable");
        return true;
    }
    false
}

/// Detects which AI agent is running and returns its name.
/// Returns None if no agent is detected.
/// Filtering against supported agents should be done on the TypeScript side.
#[napi]
pub fn detect_ai_agent(env_vars: HashMap<String, String>) -> Option<String> {
    if is_claude_ai(&env_vars) {
        Some("claude".to_string())
    } else if is_cursor_ai(&env_vars) {
        Some("cursor".to_string())
    } else if is_opencode_ai(&env_vars) {
        Some("opencode".to_string())
    } else if is_gemini_ai(&env_vars) {
        Some("gemini".to_string())
    } else if is_replit_ai(&env_vars) {
        Some("replit".to_string())
    } else {
        None
    }
}

/// Detects if the current process is being run by an AI agent
#[napi]
pub fn is_ai_agent(env_vars: HashMap<String, String>) -> bool {
    let is_ai = is_claude_ai(&env_vars)
        || is_replit_ai(&env_vars)
        || is_cursor_ai(&env_vars)
        || is_opencode_ai(&env_vars)
        || is_gemini_ai(&env_vars);

    if is_ai {
        debug!("AI agent detected");
    }

    is_ai
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_env(vars: &[(&str, &str)]) -> HashMap<String, String> {
        vars.iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn test_no_ai_detected() {
        let env = make_env(&[]);
        assert!(!is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), None);
    }

    #[test]
    fn test_claude_via_claudecode() {
        let env = make_env(&[("CLAUDECODE", "1")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("claude".to_string()));
    }

    #[test]
    fn test_claude_via_claude_code() {
        let env = make_env(&[("CLAUDE_CODE", "1")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("claude".to_string()));
    }

    #[test]
    fn test_replit() {
        let env = make_env(&[("REPL_ID", "some-repl-id")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("replit".to_string()));
    }

    #[test]
    fn test_cursor_requires_all_vars() {
        // Wrong PAGER value
        let env = make_env(&[
            ("PAGER", "wrong-value"),
            ("CURSOR_TRACE_ID", "trace-123"),
            ("COMPOSER_NO_INTERACTION", "1"),
        ]);
        assert!(!is_cursor_ai(&env));

        // Correct PAGER value
        let env = make_env(&[
            ("PAGER", "head -n 10000 | cat"),
            ("CURSOR_TRACE_ID", "trace-123"),
            ("COMPOSER_NO_INTERACTION", "1"),
        ]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("cursor".to_string()));
    }

    #[test]
    fn test_opencode() {
        let env = make_env(&[("OPENCODE", "1")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("opencode".to_string()));
    }

    #[test]
    fn test_gemini() {
        let env = make_env(&[("GEMINI_CLI", "1")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("gemini".to_string()));
    }

    #[test]
    fn test_claude_takes_priority_over_replit() {
        let env = make_env(&[("CLAUDECODE", "1"), ("REPL_ID", "some-repl-id")]);
        assert!(is_ai_agent(env.clone()));
        assert_eq!(detect_ai_agent(env), Some("claude".to_string()));
    }
}
