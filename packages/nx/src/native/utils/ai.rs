use std::env;
use tracing::debug;

/// Detects if the current process is being run by Claude Code
fn is_claude_ai() -> bool {
    match env::var("CLAUDECODE") {
        Ok(_) => {
            debug!("Claude AI detected via CLAUDECODE environment variable");
            true
        }
        Err(_) => false,
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

/// Detects if the current process is being run by an AI agent
#[napi]
pub fn is_ai_agent() -> bool {
    let is_ai = is_claude_ai() || is_replit_ai() || is_cursor_ai();

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
            "REPL_ID",
            "PAGER",
            "CURSOR_TRACE_ID",
            "COMPOSER_NO_INTERACTION",
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
        let original_repl_id = env::var("REPL_ID").ok();
        let original_pager = env::var("PAGER").ok();
        let original_cursor_trace_id = env::var("CURSOR_TRACE_ID").ok();
        let original_composer_no_interaction = env::var("COMPOSER_NO_INTERACTION").ok();

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
        assert!(!is_ai_agent(), "Should not detect any AI agent");

        // Test Claude AI detection
        unsafe {
            env::set_var("CLAUDECODE", "1");
        }
        assert!(is_claude_ai(), "Should detect Claude AI with CLAUDECODE");
        assert!(is_ai_agent(), "Main function should detect Claude AI");
        unsafe {
            env::remove_var("CLAUDECODE");
        }

        // Test Repl.it AI detection
        unsafe {
            env::set_var("REPL_ID", "some-repl-id");
        }
        assert!(is_replit_ai(), "Should detect Repl.it AI with REPL_ID");
        assert!(is_ai_agent(), "Main function should detect Repl.it AI");
        unsafe {
            env::remove_var("REPL_ID");
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
        clear_ai_env_vars();

        // Test multiple AI agents
        unsafe {
            env::set_var("CLAUDECODE", "1");
            env::set_var("REPL_ID", "some-repl-id");
        }
        assert!(
            is_ai_agent(),
            "Should detect AI when multiple agents are present"
        );

        // Restore original environment
        clear_ai_env_vars();
        if let Some(val) = original_claudecode {
            unsafe {
                env::set_var("CLAUDECODE", val);
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
    }
}
