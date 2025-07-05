use std::env;
use tracing::debug;

const AI_ENV_VARS: &[&str] = &[
    "CLAUDECODE",
    "CURSOR_TRACE_ID",
];

/// Detects if the current process is being run by an AI agent
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
        // Save and clear all AI environment variables to avoid false negatives
        let saved_vars: Vec<(String, Option<String>)> = AI_ENV_VARS
            .iter()
            .map(|&v| (v.to_string(), std::env::var(v).ok()))
            .collect();

        for &var_name in AI_ENV_VARS {
            std::env::remove_var(var_name);
        }

        // Test multiple AI environment variables
        let test_cases = [
            ("CLAUDE_CODE", "1"),
            ("AI_ASSISTANT", "test_ai"),
        ];

        for (var, value) in &test_cases {
            unsafe {
                env::set_var(var, value);
            }
            assert!(is_ai_agent(), "Should detect AI with {}", var);

            // Clear the test variable
            unsafe {
                env::remove_var(var);
            }
            assert!(
                !is_ai_agent(),
                "Should not detect AI after resetting all variables"
            );
        }

        // Restore the original environment variables
        for (var_name, value) in saved_vars {
            if let Some(val) = value {
                unsafe {
                    std::env::set_var(var_name, val);
                }
            }
        }
    }
}
