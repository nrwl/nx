use std::{
    collections::HashMap,
    io::{BufReader, Read, Write},
};

use anyhow::anyhow;
use crossbeam_channel::{bounded, unbounded, Receiver};
use crossterm::terminal::{self, disable_raw_mode, enable_raw_mode};
use crossterm::tty::IsTty;
use napi::threadsafe_function::ErrorStrategy::Fatal;
use napi::threadsafe_function::ThreadsafeFunction;
use napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking;
use napi::{Env, JsFunction};
use portable_pty::{ChildKiller, CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tracing::trace;

#[cfg(target_os = "windows")]
static CURSOR_POSITION: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();

fn command_builder() -> CommandBuilder {
    if cfg!(target_os = "windows") {
        let comspec = std::env::var("COMSPEC");
        let shell = comspec
            .as_ref()
            .map(|v| v.as_str())
            .unwrap_or_else(|_| "cmd.exe");
        let mut command = CommandBuilder::new(shell);
        command.arg("/C");

        command
    } else {
        let mut command = CommandBuilder::new("sh");
        command.arg("-c");
        command
    }
}

pub enum ChildProcessMessage {
    Kill,
}

#[napi]
pub struct ChildProcess {
    process_killer: Box<dyn ChildKiller + Sync + Send>,
    message_receiver: Receiver<String>,
    wait_receiver: Receiver<String>,
}
#[napi]
impl ChildProcess {
    pub fn new(
        process_killer: Box<dyn ChildKiller + Sync + Send>,
        message_receiver: Receiver<String>,
        exit_receiver: Receiver<String>,
    ) -> Self {
        Self {
            process_killer,
            message_receiver,
            wait_receiver: exit_receiver,
        }
    }

    #[napi]
    pub fn kill(&mut self) -> anyhow::Result<()> {
        self.process_killer.kill().map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn on_exit(
        &mut self,
        #[napi(ts_arg_type = "(message: string) => void")] callback: JsFunction,
    ) -> napi::Result<()> {
        let wait = self.wait_receiver.clone();
        let callback_tsfn: ThreadsafeFunction<String, Fatal> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        std::thread::spawn(move || {
            // we will only get one exit_code here, so we dont need to do a while loop
            if let Ok(exit_code) = wait.recv() {
                callback_tsfn.call(exit_code, NonBlocking);
            }
        });

        Ok(())
    }

    #[napi]
    pub fn on_output(
        &mut self,
        env: Env,
        #[napi(ts_arg_type = "(message: string) => void")] callback: JsFunction,
    ) -> napi::Result<()> {
        let rx = self.message_receiver.clone();

        let mut callback_tsfn: ThreadsafeFunction<String, Fatal> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        callback_tsfn.unref(&env)?;

        std::thread::spawn(move || {
            while let Ok(content) = rx.recv() {
                callback_tsfn.call(content, NonBlocking);
            }
        });

        Ok(())
    }
}

fn get_directory(command_dir: Option<String>) -> anyhow::Result<String> {
    if let Some(command_dir) = command_dir {
        Ok(command_dir)
    } else {
        std::env::current_dir()
            .map(|v| v.to_string_lossy().to_string())
            .map_err(|_| {
                anyhow!("failed to get current directory, please specify command_dir explicitly")
            })
    }
}

#[napi]
pub fn run_command(
    command: String,
    command_dir: Option<String>,
    js_env: Option<HashMap<String, String>>,
    quiet: Option<bool>,
) -> napi::Result<ChildProcess> {
    let command_dir = get_directory(command_dir)?;

    let quiet = quiet.unwrap_or(false);

    let pty_system = NativePtySystem::default();

    let (w, h) = terminal::size().unwrap_or((80, 24));
    let pair = pty_system.openpty(PtySize {
        rows: h,
        cols: w,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = command_builder();
    cmd.arg(command.as_str());
    cmd.cwd(command_dir);

    if let Some(js_env) = js_env {
        for (key, value) in js_env {
            cmd.env(key, value);
        }
    }

    let (message_tx, message_rx) = unbounded();

    let reader = pair.master.try_clone_reader()?;
    let mut stdout = std::io::stdout();

    // Output -> stdout handling
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = [0; 8 * 1024];

        let mut strip_clear_code = cfg!(target_os = "windows");

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }

            let mut content = String::from_utf8_lossy(&buffer[..n]).to_string();
            if strip_clear_code {
                strip_clear_code = false;
                // remove clear screen
                content = content.replacen("\x1B[2J", "", 1);
                // remove cursor position 1,1
                content = content.replacen("\x1B[H", "", 1);
            }

            #[cfg(target_os = "windows")]
            {
                let regex = CURSOR_POSITION.get_or_init(|| {
                    regex::Regex::new(r"\x1B\[\d+;\d+H")
                        .expect("failed to compile CURSOR ansi regex")
                });
                content = regex.replace_all(&content, "").to_string();
            }

            message_tx.send(content.to_string()).ok();
            if !quiet {
                stdout.write_all(content.as_bytes()).ok();
                stdout.flush().ok();
            }
        }
    });

    let mut child = pair.slave.spawn_command(cmd)?;
    // Release any handles owned by the slave
    // we don't need it now that we've spawned the child.
    drop(pair.slave);

    let process_killer = child.clone_killer();
    let (exit_tx, exit_rx) = bounded(1);

    let mut writer = pair.master.take_writer()?;

    // Stdin -> pty stdin
    if std::io::stdout().is_tty() {
        std::thread::spawn(move || {
            enable_raw_mode().expect("Failed to enter raw terminal mode");
            let mut stdin = std::io::stdin();
            #[allow(clippy::redundant_pattern_matching)]
            // ignore errors that come from copying the stream
            if let Ok(_) = std::io::copy(&mut stdin, &mut writer) {}
        });
    }

    std::thread::spawn(move || {
        let exit = child.wait().unwrap();
        // make sure that master is only dropped after we wait on the child. Otherwise windows does not like it
        drop(pair.master);
        disable_raw_mode().expect("Failed to restore non-raw terminal");
        exit_tx.send(exit.to_string()).ok();
    });

    Ok(ChildProcess::new(process_killer, message_rx, exit_rx))
}

/// This allows us to run a pseudoterminal with a fake node ipc channel
/// this makes it possible to be backwards compatible with the old implementation
#[napi]
pub fn nx_fork(
    id: String,
    fork_script: String,
    psuedo_ipc_path: String,
    command_dir: Option<String>,
    js_env: Option<HashMap<String, String>>,
    quiet: bool,
) -> napi::Result<ChildProcess> {
    let command = format!(
        "node {} {} {}",
        handle_path_space(fork_script),
        psuedo_ipc_path,
        id
    );

    trace!("nx_fork command: {}", &command);
    run_command(command, command_dir, js_env, Some(quiet))
}

#[cfg(target_os = "windows")]
pub fn handle_path_space(path: String) -> String {
    use std::os::windows::ffi::OsStrExt;
    use std::{ffi::OsString, os::windows::ffi::OsStringExt};

    use winapi::um::fileapi::GetShortPathNameW;
    let wide: Vec<u16> = std::path::PathBuf::from(&path)
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut buffer: Vec<u16> = vec![0; wide.len() * 2];
    let result =
        unsafe { GetShortPathNameW(wide.as_ptr(), buffer.as_mut_ptr(), buffer.len() as u32) };
    if result == 0 {
        path
    } else {
        let len = buffer.iter().position(|&x| x == 0).unwrap();
        let short_path: String = OsString::from_wide(&buffer[..len])
            .to_string_lossy()
            .into_owned();
        short_path
    }
}

#[cfg(not(target_os = "windows"))]
fn handle_path_space(path: String) -> String {
    if path.contains(' ') {
        format!("'{}'", path)
    } else {
        path
    }
}
