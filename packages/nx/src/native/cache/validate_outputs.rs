use itertools::Itertools;
use regex::Regex;

use crate::native::glob::{contains_glob_pattern, glob_transform::partition_glob};

const ALLOWED_WORKSPACE_ROOT_OUTPUT_PREFIXES: [&str; 2] = ["!{workspaceRoot}", "{workspaceRoot}"];

fn is_missing_prefix(output: &str) -> bool {
    let re = Regex::new(r"^!?\{[\s\S]+\}").expect("Output pattern regex should compile");

    !re.is_match(output)
}

#[napi]
pub fn validate_outputs(outputs: Vec<String>) -> anyhow::Result<()> {
    let (missing_prefix, workspace_globs) = outputs.iter().fold(
        (vec![], vec![]),
        |(mut missing_prefix, mut workspace_globs), output| {
            if is_missing_prefix(output) {
                missing_prefix.push(output);
            }

            for prefix in ALLOWED_WORKSPACE_ROOT_OUTPUT_PREFIXES.iter() {
                if let Some(trimmed) = output.strip_prefix(prefix) {
                    if contains_glob_pattern(&trimmed) {
                        let (root, _) = partition_glob(&trimmed);
                        if root.is_empty() {
                            workspace_globs.push(output);
                        }
                    }
                }
            }

            (missing_prefix, workspace_globs)
        },
    );

    if workspace_globs.is_empty() && missing_prefix.is_empty() {
        return Ok(());
    }

    let mut error_message = String::new();
    if !missing_prefix.is_empty() {
        error_message.push_str(&format!(
            "The following outputs are invalid: \n - {}\n\nRun `nx repair` to fix this.",
            missing_prefix.iter().join("\n - ")
        ));
    }
    if !workspace_globs.is_empty() {
        error_message.push_str(&format!(
            "The following outputs are defined by a glob pattern from the workspace root: \n - {}\n\nThese can be slow, replace them with a more specific pattern.",
            workspace_globs.iter().join("\n - ")
        ));
    }

    Err(anyhow::anyhow!(error_message))
}

#[napi]
pub fn get_transformable_outputs(outputs: Vec<String>) -> Vec<String> {
    outputs
        .into_iter()
        .filter(|output| is_missing_prefix(output))
        .collect()
}

#[cfg(test)]
mod test {
    use super::is_missing_prefix;

    #[test]
    fn test_is_missing_prefix() {
        assert!(is_missing_prefix("dist"));
        assert!(is_missing_prefix("!dist"));
        assert!(!is_missing_prefix("{workspaceRoot}/dist"));
        assert!(!is_missing_prefix("!{workspaceRoot}/dist"));
    }
}
