use crate::native::hasher::hash;
use dashmap::DashMap;
use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use tracing::trace;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Windows API constant to prevent creating a window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn hash_runtime(
    workspace_root: &str,
    command: &str,
    env: &HashMap<String, String>,
    cache: Arc<DashMap<String, String>>,
) -> anyhow::Result<String> {
    let cache_key = runtime_cache_key(command, env);

    if let Some(cache_results) = cache.get(&cache_key) {
        return Ok(cache_results.clone());
    }

    let mut command_builder = create_command_builder();

    command_builder.arg(command);

    command_builder.current_dir(workspace_root);
    env.iter().for_each(|(key, value)| {
        command_builder.env(key, value);
    });
    trace!("executing: {:?}", command_builder);
    let output = command_builder
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to execute: '{}'\n{}", command, e))?;
    trace!("{} output: {:?}", command, output);

    let std_out = std::str::from_utf8(&output.stdout)?.trim();
    let std_err = std::str::from_utf8(&output.stderr)?.trim();
    let hash_result = hash(&[std_out.as_bytes(), std_err.as_bytes()].concat());

    cache.insert(cache_key, hash_result.clone());

    Ok(hash_result)
}

fn runtime_cache_key(command: &str, env: &HashMap<String, String>) -> String {
    let mut entries: Vec<_> = env.iter().collect();
    entries.sort_by(|(a, _), (b, _)| a.cmp(b));
    format!("{}-{:?}", command, entries)
}

#[cfg(target_os = "windows")]
pub fn create_command_builder() -> Command {
    let comspec = std::env::var("COMSPEC");
    let shell = comspec
        .as_ref()
        .map(|v| v.as_str())
        .unwrap_or_else(|_| "cmd.exe");
    let mut command = Command::new(shell);
    command.creation_flags(CREATE_NO_WINDOW);
    command.arg("/C");
    command
}

#[cfg(not(target_os = "windows"))]
pub fn create_command_builder() -> Command {
    let mut command = Command::new("sh");
    command.arg("-c");
    command
}

#[cfg(test)]
mod tests {
    use super::*;
    use dashmap::DashMap;
    use std::collections::HashMap;
    use std::sync::Arc;

    #[test]
    fn test_hash_runtime() {
        let workspace_root = if cfg!(windows) { "C:\\" } else { "/tmp" };
        let command = "echo runtime";
        let env: HashMap<String, String> = HashMap::new();
        let cache = Arc::new(DashMap::new());

        let result = hash_runtime(workspace_root, command, &env, Arc::clone(&cache)).unwrap();
        assert_eq!(result, "10571312846059850300");
    }

    #[test]
    fn runtime_cache_key_is_deterministic() {
        let command = "echo runtime";
        let mut env_a = HashMap::new();
        env_a.insert("B".to_string(), "2".to_string());
        env_a.insert("A".to_string(), "1".to_string());

        let mut env_b = HashMap::new();
        env_b.insert("A".to_string(), "1".to_string());
        env_b.insert("B".to_string(), "2".to_string());

        let key_a = runtime_cache_key(command, &env_a);
        let key_b = runtime_cache_key(command, &env_b);

        assert_eq!(key_a, key_b);
    }
}
