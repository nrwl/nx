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

#[cfg_attr(windows, path = "command/windows.rs")]
#[cfg_attr(not(windows), path = "command/unix.rs")]
mod os;

fn command_builder() -> CommandBuilder {
    if cfg!(windows) {
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
                // windows will add `ESC[6n` to the beginning of the output,
                // we dont want to store this ANSI code in cache, because replays will cause issues
                // remove it before sending it to js
                #[cfg(windows)]
                let content = content.replace("\x1B[6n", "");

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

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }

            let content = &buffer[..n];
            message_tx
                .send(String::from_utf8_lossy(content).to_string())
                .ok();

            if !quiet {
                stdout.write_all(content).ok();
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
        enable_raw_mode().expect("Failed to enter raw terminal mode");
        std::thread::spawn(move || {
            let mut stdin = std::io::stdin();

            if let Err(e) = os::write_to_pty(&mut stdin, &mut writer) {
                trace!("Error writing to pty: {:?}", e);
            }
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
        os::handle_path_space(fork_script),
        psuedo_ipc_path,
        id
    );

    trace!("nx_fork command: {}", &command);
    run_command(command, command_dir, js_env, Some(quiet))
}
