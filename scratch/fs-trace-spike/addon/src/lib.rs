use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::BTreeSet;
use std::process::Command;

#[cfg(target_os = "linux")]
mod seccomp;

#[napi(object)]
pub struct TraceOptions {
    /// "none" | "preload" | "seccomp" | "hybrid" (preload + seccomp for whatever the shim misses)
    pub backend: String,
    /// Path to the built shim (preload backend).
    pub shim_path: Option<String>,
    pub cwd: Option<String>,
}

#[napi(object)]
pub struct TraceResult {
    pub exit_code: i32,
    /// Deduplicated, lexically normalised absolute paths opened for reading.
    pub reads: Vec<String>,
    /// Raw event count before dedup.
    pub events: u32,
}

pub struct TraceTask {
    cmd: String,
    args: Vec<String>,
    options: TraceOptions,
}

fn normalize(path: &str) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            p => parts.push(p),
        }
    }
    format!("/{}", parts.join("/"))
}

fn io_err(e: std::io::Error) -> Error {
    Error::from_reason(e.to_string())
}

impl TraceTask {
    fn with_preload(&self, command: &mut Command) -> Result<std::path::PathBuf> {
        let shim = self
            .options
            .shim_path
            .clone()
            .ok_or_else(|| Error::from_reason("shimPath is required for this backend"))?;
        let log = std::env::temp_dir().join(format!(
            "fstrace-{}-{:x}.log",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::File::create(&log).map_err(io_err)?;
        let var = if cfg!(target_os = "macos") { "DYLD_INSERT_LIBRARIES" } else { "LD_PRELOAD" };
        let sep = if cfg!(target_os = "macos") { ":" } else { " " };
        let preload = match std::env::var(var) {
            Ok(existing) if !existing.is_empty() => format!("{shim}{sep}{existing}"),
            _ => shim,
        };
        command.env(var, preload).env("FSTRACE_OUT", &log);
        Ok(log)
    }
}

fn collect_log(log: &std::path::Path, events: &mut u32, reads: &mut BTreeSet<String>) -> Result<()> {
    let raw = std::fs::read(log).map_err(io_err)?;
    let _ = std::fs::remove_file(log);
    for line in String::from_utf8_lossy(&raw).lines() {
        *events += 1;
        reads.insert(normalize(line));
    }
    Ok(())
}

impl Task for TraceTask {
    type Output = TraceResult;
    type JsValue = TraceResult;

    fn compute(&mut self) -> Result<TraceResult> {
        let mut command = Command::new(&self.cmd);
        command.args(&self.args);
        if let Some(cwd) = &self.options.cwd {
            command.current_dir(cwd);
        }
        match self.options.backend.as_str() {
            "none" => {
                let status = command.status().map_err(io_err)?;
                Ok(TraceResult { exit_code: status.code().unwrap_or(-1), reads: vec![], events: 0 })
            }
            "preload" => {
                let log = self.with_preload(&mut command)?;
                let status = command.status().map_err(io_err)?;
                let (mut events, mut reads) = (0, BTreeSet::new());
                collect_log(&log, &mut events, &mut reads)?;
                Ok(TraceResult { exit_code: status.code().unwrap_or(-1), reads: reads.into_iter().collect(), events })
            }
            #[cfg(target_os = "linux")]
            backend @ ("seccomp" | "hybrid") => {
                let log = if backend == "hybrid" { Some(self.with_preload(&mut command)?) } else { None };
                let (code, mut events, raw) = seccomp::run(command, log.is_some()).map_err(io_err)?;
                let mut reads: BTreeSet<String> = raw.iter().map(|p| normalize(p)).collect();
                if let Some(log) = log {
                    collect_log(&log, &mut events, &mut reads)?;
                }
                Ok(TraceResult { exit_code: code, reads: reads.into_iter().collect(), events })
            }
            other => Err(Error::from_reason(format!("unsupported backend on this platform: {other}"))),
        }
    }

    fn resolve(&mut self, _env: Env, output: TraceResult) -> Result<TraceResult> {
        Ok(output)
    }
}

/// Spawns `cmd` with inherited stdio and resolves with every file its process tree opened for reading.
#[napi]
pub fn trace_spawn(cmd: String, args: Vec<String>, options: TraceOptions) -> AsyncTask<TraceTask> {
    AsyncTask::new(TraceTask { cmd, args, options })
}
