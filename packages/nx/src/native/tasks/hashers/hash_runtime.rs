use crate::native::hasher::hash;
use crate::native::utils::command::create_shell_command;
use dashmap::DashMap;
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::{Arc, OnceLock};
use tracing::trace;

/// One hash_plans invocation's runtime commands and environments, including in-flight failures.
pub type RuntimeCache = DashMap<String, Arc<OnceLock<Result<String, String>>>>;
pub fn hash_runtime(
    workspace_root: &str,
    command: &str,
    env: &HashMap<String, String>,
    cache: &RuntimeCache,
) -> anyhow::Result<String> {
    // Drop the map's shard guard before running or waiting: unrelated keys must proceed independently.
    let cell = cache
        .entry(runtime_cache_key(command, env))
        .or_insert_with(|| Arc::new(OnceLock::new()))
        .clone();
    cell.get_or_init(|| {
        run_runtime(workspace_root, command, env).map_err(|error| format!("{error:#}"))
    })
    .clone()
    .map_err(anyhow::Error::msg)
}

fn run_runtime(
    workspace_root: &str,
    command: &str,
    env: &HashMap<String, String>,
) -> anyhow::Result<String> {
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
    Ok(hash(&[std_out.as_bytes(), std_err.as_bytes()].concat()))
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
    use std::sync::Barrier;

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

    #[test]
    fn concurrent_identical_requests_run_once_and_the_next_invocation_runs_again() {
        let root = tempfile::tempdir().unwrap();
        let command =
            "node -e \"require('fs').appendFileSync('runs', 'run\\n'); console.log('joined')\"";
        let cache = RuntimeCache::new();
        let env = HashMap::new();
        let barrier = Barrier::new(8);
        std::thread::scope(|scope| {
            let handles: Vec<_> = (0..8)
                .map(|_| {
                    scope.spawn(|| {
                        barrier.wait();
                        hash_runtime(root.path().to_str().unwrap(), command, &env, &cache).unwrap()
                    })
                })
                .collect();
            for handle in handles {
                assert_eq!(handle.join().unwrap(), hash(b"joined"));
            }
        });
        assert_eq!(
            std::fs::read_to_string(root.path().join("runs")).unwrap(),
            "run\n"
        );
        assert_eq!(
            hash_runtime(
                root.path().to_str().unwrap(),
                command,
                &env,
                &RuntimeCache::new()
            )
            .unwrap(),
            hash(b"joined")
        );
        assert_eq!(
            std::fs::read_to_string(root.path().join("runs")).unwrap(),
            "run\nrun\n"
        );
    }

    #[test]
    fn concurrent_failures_share_one_execution() {
        let root = tempfile::tempdir().unwrap();
        let command = "node -e \"require('fs').appendFileSync('runs', 'run\\n'); process.stdout.write(Buffer.from([255]))\"";
        let cache = RuntimeCache::new();
        let env = HashMap::new();
        let barrier = Barrier::new(8);
        let errors = std::thread::scope(|scope| {
            let handles: Vec<_> = (0..8)
                .map(|_| {
                    scope.spawn(|| {
                        barrier.wait();
                        hash_runtime(root.path().to_str().unwrap(), command, &env, &cache)
                            .unwrap_err()
                            .to_string()
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|handle| handle.join().unwrap())
                .collect::<Vec<_>>()
        });
        assert!(errors[0].contains("invalid utf-8"));
        assert!(errors.iter().all(|error| error == &errors[0]));
        assert_eq!(
            std::fs::read_to_string(root.path().join("runs")).unwrap(),
            "run\n"
        );
    }

    #[test]
    fn different_environments_execute_separately() {
        let root = tempfile::tempdir().unwrap();
        let command = "node -e \"require('fs').appendFileSync('runs', 'run\\n'); console.log(process.env.NX_RUNTIME_VALUE)\"";
        let cache = RuntimeCache::new();
        let first = HashMap::from([("NX_RUNTIME_VALUE".to_string(), "one".to_string())]);
        let second = HashMap::from([("NX_RUNTIME_VALUE".to_string(), "two".to_string())]);
        let barrier = Barrier::new(2);
        std::thread::scope(|scope| {
            let one = scope.spawn(|| {
                barrier.wait();
                hash_runtime(root.path().to_str().unwrap(), command, &first, &cache).unwrap()
            });
            let two = scope.spawn(|| {
                barrier.wait();
                hash_runtime(root.path().to_str().unwrap(), command, &second, &cache).unwrap()
            });
            assert_eq!(one.join().unwrap(), hash(b"one"));
            assert_eq!(two.join().unwrap(), hash(b"two"));
        });
        assert_eq!(
            std::fs::read_to_string(root.path().join("runs")).unwrap(),
            "run\nrun\n"
        );
    }
}
