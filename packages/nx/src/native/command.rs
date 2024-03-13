use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use crate::native::logger::enable_logger;

use anyhow::anyhow;
use crossbeam_channel::{bounded, unbounded, Receiver};
use crossterm::terminal::{self, disable_raw_mode, enable_raw_mode};
use crossterm::tty::IsTty;
use napi::threadsafe_function::ErrorStrategy::Fatal;
use napi::threadsafe_function::ThreadsafeFunction;
use napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking;
use napi::{Env, JsFunction};
use portable_pty::{ChildKiller, CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use tracing::trace;

#[cfg_attr(windows, path = "command/windows.rs")]
#[cfg_attr(not(windows), path = "command/unix.rs")]
mod os;

#[napi]
pub struct RustPseudoTerminal {
    pty_pair: PtyPair,
    message_rx: Receiver<String>,
    printing_rx: Receiver<()>,
    quiet: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
}

#[napi]
impl RustPseudoTerminal {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        enable_logger();

        let quiet = Arc::new(AtomicBool::new(true));
        let running = Arc::new(AtomicBool::new(false));

        let pty_system = NativePtySystem::default();

        let (w, h) = terminal::size().unwrap_or((80, 24));
        trace!("Opening Pseudo Terminal");
        let pty_pair = pty_system.openpty(PtySize {
            rows: h,
            cols: w,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut writer = pty_pair.master.take_writer()?;
        // Stdin -> pty stdin
        if std::io::stdout().is_tty() {
            trace!("Passing through stdin");
            std::thread::spawn(move || {
                let mut stdin = std::io::stdin();
                if let Err(e) = os::write_to_pty(&mut stdin, &mut writer) {
                    trace!("Error writing to pty: {:?}", e);
                }
            });
        }
        if std::io::stdout().is_tty() {
            trace!("Enabling raw mode");
            enable_raw_mode().expect("Failed to enter raw terminal mode");
        }

        let mut reader = pty_pair.master.try_clone_reader()?;
        let (message_tx, message_rx) = unbounded();
        let (printing_tx, printing_rx) = unbounded();
        // Output -> stdout handling
        let quiet_clone = quiet.clone();
        let running_clone = running.clone();
        std::thread::spawn(move || {
            let mut stdout = std::io::stdout();
            let mut buf = [0; 8 * 1024];

            loop {
                if let Ok(len) = reader.read(&mut buf) {
                    if len == 0 {
                        break;
                    }
                    message_tx
                        .send(String::from_utf8_lossy(&buf[0..len]).to_string())
                        .ok();
                    let quiet = quiet_clone.load(Ordering::Relaxed);
                    trace!("Quiet: {}", quiet);
                    if !quiet {
                        if stdout.write_all(&buf[0..len]).is_err() {
                            break;
                        } else {
                            let _ = stdout.flush();
                        }
                    }
                }
                if !running_clone.load(Ordering::SeqCst) {
                    printing_tx.send(()).ok();
                }
            }
            printing_tx.send(()).ok();
        });
        if std::io::stdout().is_tty() {
            disable_raw_mode().expect("Failed to enter raw terminal mode");
        }

        Ok(RustPseudoTerminal {
            pty_pair,
            message_rx,
            printing_rx,
            quiet,
            running,
        })
    }

    #[napi]
    pub fn run_command(
        &self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        quiet: Option<bool>,
    ) -> napi::Result<ChildProcess> {
        let command_dir = get_directory(command_dir)?;

        let pair = &self.pty_pair;

        let quiet = quiet.unwrap_or(false);

        self.quiet.store(quiet, Ordering::Relaxed);

        let mut cmd = command_builder();
        cmd.arg(command.as_str());
        cmd.cwd(command_dir);

        if let Some(js_env) = js_env {
            for (key, value) in js_env {
                cmd.env(key, value);
            }
        }

        let (exit_to_process_tx, exit_to_process_rx) = bounded(1);
        let mut child = pair.slave.spawn_command(cmd)?;
        self.running.store(true, Ordering::SeqCst);
        trace!("Running {}", command);
        let is_tty = std::io::stdout().is_tty();
        if is_tty {
            trace!("Enabling raw mode");
            enable_raw_mode().expect("Failed to enter raw terminal mode");
        }
        let process_killer = child.clone_killer();

        let running_clone = self.running.clone();
        let printing_rx = self.printing_rx.clone();
        std::thread::spawn(move || {
            trace!("Waiting for {}", command);

            let res = child.wait();
            if let Ok(exit) = res {
                trace!("{} Exited", command);
                running_clone.store(false, Ordering::SeqCst);
                trace!("Waiting for printing to finish");
                let timeout = 500;
                let a = Instant::now();
                // This mitigates the issues with ConPTY on windows and makes it work.
                loop {
                    if let Ok(_) = printing_rx.try_recv() {
                        break;
                    }
                    if a.elapsed().as_millis() > timeout {
                        break;
                    }
                }
                if is_tty {
                    disable_raw_mode().expect("Failed to restore non-raw terminal");
                }
                exit_to_process_tx.send(exit.to_string()).ok();
            };
        });

        Ok(ChildProcess::new(
            process_killer,
            self.message_rx.clone(),
            exit_to_process_rx,
        ))
    }

    /// This allows us to run a pseudoterminal with a fake node ipc channel
    /// this makes it possible to be backwards compatible with the old implementation
    #[napi]
    pub fn fork(
        &self,
        id: String,
        fork_script: String,
        pseudo_ipc_path: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        quiet: bool,
    ) -> napi::Result<ChildProcess> {
        let command = format!(
            "node {} {} {}",
            os::handle_path_space(fork_script),
            pseudo_ipc_path,
            id
        );

        trace!("nx_fork command: {}", &command);
        self.run_command(command, command_dir, js_env, Some(quiet))
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn can_run_commands() {
        let mut i = 0;
        let pseudo_terminal = RustPseudoTerminal::new().unwrap();
        while i < 10 {
            println!("Running {}", i);
            let cp1 = pseudo_terminal
                .run_command(String::from("dir"), None, None, None)
                .unwrap();
            cp1.wait_receiver.recv().unwrap();
            i += 1;
        }
        drop(pseudo_terminal);
    }
}
