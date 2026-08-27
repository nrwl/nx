use crate::native::hasher::hash;
use crate::native::utils::command::create_shell_command;
use dashmap::DashMap;
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tracing::trace;

pub fn hash_runtime(
    workspace_root: &str,
    command: &str,
    env: &HashMap<String, String>,
    cache: &DashMap<String, String>,
) -> anyhow::Result<String> {
    let cache_key = runtime_cache_key(command, env);

    if let Some(cache_results) = cache.get(&cache_key) {
        return Ok(cache_results.clone());
    }

    let mut command_builder = create_shell_command();

    append_shell_command(&mut command_builder, command);

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

// Rust escapes inner quotes as \" when it quotes an argument, and `cmd /C`
// keeps that escape, so any quoted token inside the command reaches its
// program mangled. Hand cmd the raw line wrapped in one outer quote pair
// instead, which it strips as documented for /C.
#[cfg(target_os = "windows")]
fn append_shell_command(command_builder: &mut Command, command: &str) {
    if command.contains('"') {
        command_builder.raw_arg(format!("\"{command}\""));
    } else {
        command_builder.arg(command);
    }
}

#[cfg(not(target_os = "windows"))]
fn append_shell_command(command_builder: &mut Command, command: &str) {
    command_builder.arg(command);
}

fn runtime_cache_key(command: &str, env: &HashMap<String, String>) -> String {
    let mut entries: Vec<_> = env.iter().collect();
    entries.sort_by(|(a, _), (b, _)| a.cmp(b));
    format!("{}-{:?}", command, entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use dashmap::DashMap;
    use std::collections::HashMap;

    #[test]
    fn test_hash_runtime() {
        let workspace_root = if cfg!(windows) { "C:\\" } else { "/tmp" };
        let command = "echo runtime";
        let env: HashMap<String, String> = HashMap::new();
        let cache = DashMap::new();

        let result = hash_runtime(workspace_root, command, &env, &cache).unwrap();
        assert_eq!(result, "10571312846059850300");
    }

    #[test]
    fn hashes_output_of_command_with_quoted_argument() {
        let workspace_root = if cfg!(windows) { "C:\\" } else { "/tmp" };
        let command = "node -e \"console.log('a b')\"";
        let env: HashMap<String, String> = HashMap::new();
        let cache = DashMap::new();

        let result = hash_runtime(workspace_root, command, &env, &cache).unwrap();
        assert_eq!(result, hash(b"a b"));
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
