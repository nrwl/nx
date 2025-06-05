use std::env;
use tracing::debug;

const AI_ENV_VARS: &[&str] = &[
    "OPENAI_API_KEY",
    "CLAUDE_CODE",
    "CURSOR_SESSION",
    "CODEX_SESSION",
    "AI_ASSISTANT",
    "COPILOT_SESSION",
    "GITHUB_COPILOT",
];

/// Detects if the current process is being run by an AI agent like Claude, Cursor, or Codex
#[napi]
pub fn is_ai_agent() -> bool {
    debug!("Checking for AI agent environment variables");

    let is_ai = AI_ENV_VARS.iter().any(|var| match env::var(var) {
        Ok(_) => {
            debug!("Found AI environment variable: {}", var);
            true
        }
        Err(_) => {
            debug!("AI environment variable not set: {}", var);
            false
        }
    });

    if is_ai {
        debug!("AI agent detected");
    } else {
        debug!("No AI agent environment variables found");
    }

    is_ai
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_detection_with_different_env_vars() {
        // Test multiple AI environment variables to avoid conflicts
        let test_cases = [
            ("CURSOR_SESSION", "test_cursor"),
            ("CODEX_SESSION", "test_codex"),
            ("AI_ASSISTANT", "test_ai"),
        ];

        for (var, value) in &test_cases {
            // Store original value
            let original = env::var(var).ok();

            unsafe {
                env::set_var(var, value);
            }
            assert!(is_ai_agent(), "Should detect AI with {}", var);

            // Restore original state
            match original {
                Some(orig_val) => unsafe { env::set_var(var, orig_val) },
                None => unsafe { env::remove_var(var) },
            }
            assert!(
                !is_ai_agent(),
                "Should not detect AI after resetting {}",
                var
            );
        }
    }
}
