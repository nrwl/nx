use std::{
    collections::HashMap,
    env,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use anyhow::anyhow;
use crossbeam_channel::{bounded, unbounded, Receiver};
use crossterm::{
    terminal,
    terminal::{disable_raw_mode, enable_raw_mode},
    tty::IsTty,
};
use napi::bindgen_prelude::*;
use portable_pty::{CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use tracing::log::trace;
use vt100_ctt::Parser;

use super::os;
use crate::native::pseudo_terminal::child_process::ChildProcess;

pub struct PseudoTerminal {
    pub pty_pair: PtyPair,
    pub message_rx: Receiver<String>,
    pub printing_rx: Receiver<()>,
    pub quiet: Arc<AtomicBool>,
    pub running: Arc<AtomicBool>,
}

pub struct PseudoTerminalOptions {
    pub size: (u16, u16),
    pub passthrough_stdin: bool,
}

impl Default for PseudoTerminalOptions {
    fn default() -> Self {
        let (w, h) = terminal::size().unwrap_or((80, 24));
        Self {
            size: (w, h),
            passthrough_stdin: !env::var("NX_TUI").is_ok_and(|s| s == "true"),
        }
    }
}

impl PseudoTerminal {
    pub fn new(options: PseudoTerminalOptions) -> Result<Self> {
        let quiet = Arc::new(AtomicBool::new(true));
        let running = Arc::new(AtomicBool::new(false));

        let pty_system = NativePtySystem::default();

        trace!("Opening Pseudo Terminal");
        let (w, h) = options.size;
        let pty_pair = pty_system.openpty(PtySize {
            rows: h,
            cols: w,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut writer = pty_pair.master.take_writer()?;
        if options.passthrough_stdin && std::io::stdout().is_tty() {
            // Stdin -> pty stdin
            trace!("Passing through stdin");
            std::thread::spawn(move || {
                let mut stdin = std::io::stdin();
                if let Err(e) = os::write_to_pty(&mut stdin, &mut writer) {
                    trace!("Error writing to pty: {:?}", e);
                }
            });
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
            let mut parser = Parser::new(h, w, 10000);
            let mut first: bool = true;

            'read_loop: loop {
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
                        let prev = parser.screen().clone();
                        parser.process(&buf[0..len]);
                        let write_buf = if first {
                            parser.screen().all_contents_formatted()
                        } else {
                            parser.screen().contents_diff(&prev)
                        };
                        first = false;

                        let mut logged_interrupted_error = false;
                        while let Err(e) = stdout.write_all(&write_buf) {
                            match e.kind() {
                                std::io::ErrorKind::Interrupted => {
                                    if !logged_interrupted_error {
                                        trace!("Interrupted error writing to stdout: {:?}", e);
                                        logged_interrupted_error = true;
                                    }
                                    continue;
                                }
                                _ => {
                                    // We should figure out what to do for more error types as they appear.
                                    trace!("Error writing to stdout: {:?}", e);
                                    trace!("Error kind: {:?}", e.kind());
                                    break 'read_loop;
                                }
                            }
                        }
                        let _ = stdout.flush();
                    }
                }
                if !running_clone.load(Ordering::SeqCst) {
                    printing_tx.send(()).ok();
                }
            }

            printing_tx.send(()).ok();
        });
        Ok(PseudoTerminal {
            quiet,
            running,
            pty_pair,
            message_rx,
            printing_rx,
        })
    }

    pub fn default() -> Result<PseudoTerminal> {
        Self::new(PseudoTerminalOptions::default())
    }

    pub fn run_command(
        &mut self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        quiet: Option<bool>,
        tty: Option<bool>,
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

        if let Some(exec_argv) = exec_argv {
            cmd.env("NX_PSEUDO_TERMINAL_EXEC_ARGV", exec_argv.join("|"));
        }

        let (exit_to_process_tx, exit_to_process_rx) = bounded(1);
        trace!("Running {}", command);
        let mut child = pair.slave.spawn_command(cmd)?;
        self.running.store(true, Ordering::SeqCst);
        let is_tty = tty.unwrap_or_else(|| std::io::stdout().is_tty());
        if is_tty {
            trace!("Enabling raw mode");
            enable_raw_mode().expect("Failed to enter raw terminal mode");
        }
        let process_killer = child.clone_killer();

        trace!("Getting running clone");
        let running_clone = self.running.clone();
        trace!("Getting printing_rx clone");
        let printing_rx = self.printing_rx.clone();

        trace!("spawning thread to wait for command");
        std::thread::spawn(move || {
            trace!("Waiting for {}", command);

            let res = child.wait();
            if let Ok(exit) = res {
                trace!("{} Exited", command);
                // This mitigates the issues with ConPTY on windows and makes it work.
                running_clone.store(false, Ordering::SeqCst);
                if cfg!(windows) {
                    trace!("Waiting for printing to finish");
                    let timeout = 500;
                    let a = Instant::now();
                    loop {
                        if printing_rx.try_recv().is_ok() {
                            break;
                        }
                        if a.elapsed().as_millis() > timeout {
                            break;
                        }
                    }
                    trace!("Printing finished");
                }
                if is_tty {
                    trace!("Disabling raw mode");
                    disable_raw_mode().expect("Failed to restore non-raw terminal");
                }
                exit_to_process_tx.send(exit.to_string()).ok();
            } else {
                trace!("Error waiting for {}", command);
            };
        });

        trace!("Returning ChildProcess");
        Ok(ChildProcess::new(
            process_killer,
            self.message_rx.clone(),
            exit_to_process_rx,
        ))
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

pub fn command_builder() -> CommandBuilder {
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
        let mut pseudo_terminal = PseudoTerminal::default().unwrap();
        while i < 10 {
            println!("Running {}", i);
            let cp1 = pseudo_terminal
                .run_command(String::from("whoami"), None, None, None)
                .unwrap();
            cp1.wait_receiver.recv().unwrap();
            i += 1;
        }
        drop(pseudo_terminal);
    }
}
