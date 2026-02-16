use std::env;
use tracing::debug;

/// Detects if the current process is being run by Claude Code
fn is_claude_ai() -> bool {
    match env::var("CLAUDECODE") {
        Ok(_) => {
            debug!("Claude AI detected via CLAUDECODE environment variable");
            true
        }
        Err(_) => match env::var("CLAUDE_CODE") {
            Ok(_) => {
                debug!("Claude AI detected via CLAUDE_CODE environment variable");
                true
            }
            Err(_) => false,
        },
    }
}

/// Detects if the current process is being run by Repl.it
fn is_replit_ai() -> bool {
    match env::var("REPL_ID") {
        Ok(_) => {
            debug!("Repl.it AI detected via REPL_ID environment variable");
            true
        }
        Err(_) => false,
    }
}

/// Detects if the current process is being run by Cursor AI
fn is_cursor_ai() -> bool {
    let pager_matches = env::var("PAGER")
        .map(|v| v == "head -n 10000 | cat")
        .unwrap_or(false);
    let has_cursor_trace_id = env::var("CURSOR_TRACE_ID").is_ok();
    let has_composer_no_interaction = env::var("COMPOSER_NO_INTERACTION").is_ok();

    let is_cursor = pager_matches && has_cursor_trace_id && has_composer_no_interaction;

    if is_cursor {
        debug!(
            "Cursor AI detected via PAGER, CURSOR_TRACE_ID, and COMPOSER_NO_INTERACTION environment variables"
        );
    }

    is_cursor
}

/// Detects if the current process is being run by OpenCode
fn is_opencode_ai() -> bool {
    match env::var("OPENCODE") {
        Ok(_) => {
            debug!("OpenCode AI detected via OPENCODE environment variable");
            true
        }
        Err(_) => false,
    }
}

/// Detects if the current process is being run by Gemini CLI
fn is_gemini_ai() -> bool {
    match env::var("GEMINI_CLI") {
        Ok(_) => {
            debug!("Gemini CLI detected via GEMINI_CLI environment variable");
            true
        }
        Err(_) => false,
    }
}

/// Detects which AI agent is running and returns its name.
/// Returns None if no agent is detected.
/// Filtering against supported agents should be done on the TypeScript side.
#[napi]
pub fn detect_ai_agent() -> Option<String> {
    if is_claude_ai() {
        Some("claude".to_string())
    } else if is_cursor_ai() {
        Some("cursor".to_string())
    } else if is_opencode_ai() {
        Some("opencode".to_string())
    } else if is_gemini_ai() {
        Some("gemini".to_string())
    } else if is_replit_ai() {
        Some("replit".to_string())
    } else {
        None
    }
}

/// Detects if the current process is being run by an AI agent
#[napi]
pub fn is_ai_agent() -> bool {
    let is_ai =
        is_claude_ai() || is_replit_ai() || is_cursor_ai() || is_opencode_ai() || is_gemini_ai();

    if is_ai {
        debug!("AI agent detected");
    }

    is_ai
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clear_ai_env_vars() {
        let ai_vars = [
            "CLAUDECODE",
            "CLAUDE_CODE",
            "REPL_ID",
            "PAGER",
            "CURSOR_TRACE_ID",
            "COMPOSER_NO_INTERACTION",
            "OPENCODE",
            "GEMINI_CLI",
        ];
        for var in &ai_vars {
            unsafe {
                std::env::remove_var(var);
            }
        }
    }

    #[test]
    fn test_ai_agent_detection() {
        // Save original environment state
        let original_claudecode = env::var("CLAUDECODE").ok();
        let original_claude_code = env::var("CLAUDE_CODE").ok();
        let original_repl_id = env::var("REPL_ID").ok();
        let original_pager = env::var("PAGER").ok();
        let original_cursor_trace_id = env::var("CURSOR_TRACE_ID").ok();
        let original_composer_no_interaction = env::var("COMPOSER_NO_INTERACTION").ok();
        let original_opencode = env::var("OPENCODE").ok();
        let original_gemini_cli = env::var("GEMINI_CLI").ok();

        // Start with clean environment
        clear_ai_env_vars();

        // Test no AI detection
        assert!(
            !is_claude_ai(),
            "Should not detect Claude AI without CLAUDECODE"
        );
        assert!(
            !is_replit_ai(),
            "Should not detect Repl.it AI without REPL_ID"
        );
        assert!(
            !is_cursor_ai(),
            "Should not detect Cursor AI without all variables"
        );
        assert!(
            !is_opencode_ai(),
            "Should not detect OpenCode AI without OPENCODE"
        );
        assert!(
            !is_gemini_ai(),
            "Should not detect Gemini CLI without GEMINI_CLI"
        );
        assert!(!is_ai_agent(), "Should not detect any AI agent");

        // Test Claude AI detection via CLAUDECODE
        unsafe {
            env::set_var("CLAUDECODE", "1");
        }
        assert!(is_claude_ai(), "Should detect Claude AI with CLAUDECODE");
        assert!(is_ai_agent(), "Main function should detect Claude AI");
        assert_eq!(
            detect_ai_agent(),
            Some("claude".to_string()),
            "detect_ai_agent should return claude"
        );
        unsafe {
            env::remove_var("CLAUDECODE");
        }

        // Test Claude AI detection via CLAUDE_CODE (underscore variant)
        unsafe {
            env::set_var("CLAUDE_CODE", "1");
        }
        assert!(is_claude_ai(), "Should detect Claude AI with CLAUDE_CODE");
        assert!(
            is_ai_agent(),
            "Main function should detect Claude AI via CLAUDE_CODE"
        );
        assert_eq!(
            detect_ai_agent(),
            Some("claude".to_string()),
            "detect_ai_agent should return claude for CLAUDE_CODE"
        );
        unsafe {
            env::remove_var("CLAUDE_CODE");
        }

        // Test Repl.it AI detection
        unsafe {
            env::set_var("REPL_ID", "some-repl-id");
        }
        assert!(is_replit_ai(), "Should detect Repl.it AI with REPL_ID");
        assert!(is_ai_agent(), "Main function should detect Repl.it AI");
        assert_eq!(
            detect_ai_agent(),
            Some("replit".to_string()),
            "detect_ai_agent should return replit"
        );
        unsafe {
            env::remove_var("REPL_ID");
        }

        // Test OpenCode AI detection
        unsafe {
            env::set_var("OPENCODE", "1");
        }
        assert!(is_opencode_ai(), "Should detect OpenCode AI with OPENCODE");
        assert!(is_ai_agent(), "Main function should detect OpenCode AI");
        assert_eq!(
            detect_ai_agent(),
            Some("opencode".to_string()),
            "detect_ai_agent should return opencode"
        );
        unsafe {
            env::remove_var("OPENCODE");
        }

        // Test Cursor AI detection with wrong PAGER
        unsafe {
            env::set_var("PAGER", "wrong-value");
            env::set_var("CURSOR_TRACE_ID", "trace-123");
            env::set_var("COMPOSER_NO_INTERACTION", "1");
        }
        assert!(
            !is_cursor_ai(),
            "Should not detect Cursor AI with wrong PAGER value"
        );

        // Test Cursor AI detection with correct PAGER
        unsafe {
            env::set_var("PAGER", "head -n 10000 | cat");
        }
        assert!(
            is_cursor_ai(),
            "Should detect Cursor AI with correct PAGER and all variables"
        );
        assert!(is_ai_agent(), "Main function should detect Cursor AI");
        assert_eq!(
            detect_ai_agent(),
            Some("cursor".to_string()),
            "detect_ai_agent should return cursor"
        );
        clear_ai_env_vars();

        // Test Gemini CLI detection
        unsafe {
            env::set_var("GEMINI_CLI", "1");
        }
        assert!(is_gemini_ai(), "Should detect Gemini CLI with GEMINI_CLI");
        assert!(is_ai_agent(), "Main function should detect Gemini CLI");
        assert_eq!(
            detect_ai_agent(),
            Some("gemini".to_string()),
            "detect_ai_agent should return gemini"
        );
        unsafe {
            env::remove_var("GEMINI_CLI");
        }

        // Test multiple AI agents
        unsafe {
            env::set_var("CLAUDECODE", "1");
            env::set_var("REPL_ID", "some-repl-id");
        }
        assert!(
            is_ai_agent(),
            "Should detect AI when multiple agents are present"
        );

        // Test detect_ai_agent with no agents
        clear_ai_env_vars();
        assert_eq!(
            detect_ai_agent(),
            None,
            "detect_ai_agent should return None when no agent is detected"
        );

        // Restore original environment
        clear_ai_env_vars();
        if let Some(val) = original_claudecode {
            unsafe {
                env::set_var("CLAUDECODE", val);
            }
        }
        if let Some(val) = original_claude_code {
            unsafe {
                env::set_var("CLAUDE_CODE", val);
            }
        }
        if let Some(val) = original_repl_id {
            unsafe {
                env::set_var("REPL_ID", val);
            }
        }
        if let Some(val) = original_pager {
            unsafe {
                env::set_var("PAGER", val);
            }
        }
        if let Some(val) = original_cursor_trace_id {
            unsafe {
                env::set_var("CURSOR_TRACE_ID", val);
            }
        }
        if let Some(val) = original_composer_no_interaction {
            unsafe {
                env::set_var("COMPOSER_NO_INTERACTION", val);
            }
        }
        if let Some(val) = original_opencode {
            unsafe {
                env::set_var("OPENCODE", val);
            }
        }
        if let Some(val) = original_gemini_cli {
            unsafe {
                env::set_var("GEMINI_CLI", val);
            }
        }
    }
}
