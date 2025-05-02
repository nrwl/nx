use anyhow::anyhow;
use crossbeam_channel::{bounded, unbounded, Receiver, Sender};
use crossterm::{
    terminal,
    terminal::{disable_raw_mode, enable_raw_mode},
    tty::IsTty,
};
use napi::bindgen_prelude::*;
use portable_pty::{CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use std::io::stdout;
use std::sync::{Mutex, RwLock};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};
use tracing::debug;
use tracing::log::trace;
use vt100_ctt::Parser;

use super::os;
use crate::native::pseudo_terminal::{child_process::ChildProcess, process_killer::ProcessKiller};

pub struct PseudoTerminal {
    pub pty_pair: PtyPair,
    pub stdout_tx: Sender<String>,
    pub stdout_rx: Receiver<String>,
    pub printing_rx: Receiver<()>,
    pub quiet: Arc<AtomicBool>,
    pub running: Arc<AtomicBool>,
    pub writer: WriterArc,
    pub parser: ParserArc,
    is_within_nx_tui: bool,
}

pub struct PseudoTerminalOptions {
    pub size: (u16, u16),
}

impl Default for PseudoTerminalOptions {
    fn default() -> Self {
        let (w, h) = terminal::size().unwrap_or((80, 24));
        Self { size: (w, h) }
    }
}

pub type ParserArc = Arc<RwLock<Parser>>;
pub type WriterArc = Arc<Mutex<Box<dyn Write + Send>>>;

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

        let writer = pty_pair.master.take_writer()?;
        let writer_arc = Arc::new(Mutex::new(writer));
        let writer_clone = writer_arc.clone();

        let is_within_nx_tui =
            std::env::var("NX_TUI").unwrap_or_else(|_| String::from("false")) == "true";
        if !is_within_nx_tui && stdout().is_tty() {
            // Stdin -> pty stdin
            trace!("Passing through stdin");
            std::thread::spawn(move || {
                let mut stdin = std::io::stdin();
                if let Err(e) = os::write_to_pty(&mut stdin, writer_clone) {
                    trace!("Error writing to pty: {:?}", e);
                }
            });
        }

        let mut reader = pty_pair.master.try_clone_reader()?;
        let (stdout_tx, stdout_rx) = unbounded();
        let (printing_tx, printing_rx) = unbounded();
        // Output -> stdout handling
        let quiet_clone = quiet.clone();
        let running_clone = running.clone();

        let parser = Arc::new(RwLock::new(Parser::new(h, w, 10000)));
        let parser_clone = parser.clone();
        let stdout_tx_clone = stdout_tx.clone();
        std::thread::spawn(move || {
            let mut stdout = std::io::stdout();
            let mut buf = [0; 8 * 1024];

            'read_loop: loop {
                if let Ok(len) = reader.read(&mut buf) {
                    if len == 0 {
                        break;
                    }
                    stdout_tx_clone
                        .send(String::from_utf8_lossy(&buf[0..len]).to_string())
                        .ok();
                    let quiet = quiet_clone.load(Ordering::Relaxed);
                    trace!("Quiet: {}", quiet);
                    debug!("Read {} bytes", len);
                    if let Ok(mut parser) = parser_clone.write() {
                        if is_within_nx_tui {
                            parser.process(&buf[..len]);
                        }

                        if !quiet {
                            let mut logged_interrupted_error = false;

                            let mut content = String::from_utf8_lossy(&buf[0..len]).to_string();
                            if content.contains("\x1B[6n") {
                                trace!(
                                    "Prevented terminal escape sequence ESC[6n from being printed."
                                );
                                content = content.replace("\x1B[6n", "");
                            }

                            let write_buf = content.as_bytes();
                            debug!("Escaped Stdout: {:?}", write_buf.escape_ascii().to_string());

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
                    } else {
                        debug!("Failed to lock parser");
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
            writer: writer_arc,
            running,
            parser,
            pty_pair,
            stdout_rx,
            stdout_tx,
            printing_rx,
            is_within_nx_tui,
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
        command_label: Option<String>,
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

        let command_clone = command.clone();
        let command_info = format!("> {}\n\n\r", command_label.unwrap_or(command));
        self.stdout_tx.send(command_info.clone()).ok();

        self.parser
            .write()
            .expect("Failed to acquire parser write lock")
            .process(command_info.as_bytes());
        trace!("Running {}", command_clone);
        let mut child = pair.slave.spawn_command(cmd)?;
        self.running.store(true, Ordering::SeqCst);

        let is_tty = tty.unwrap_or_else(|| std::io::stdout().is_tty());
        // Do not manipulate raw mode if running within the context of the NX_TUI, it handles it itself
        let should_control_raw_mode = is_tty && !self.is_within_nx_tui;
        if should_control_raw_mode {
            trace!("Enabling raw mode");
            enable_raw_mode().expect("Failed to enter raw terminal mode");
        }
        let process_killer = ProcessKiller::new(
            child
                .process_id()
                .expect("unable to determine child process id") as i32,
        );

        trace!("Getting running clone");
        let running_clone = self.running.clone();
        trace!("Getting printing_rx clone");
        let printing_rx = self.printing_rx.clone();

        trace!("spawning thread to wait for command");
        std::thread::spawn(move || {
            trace!("Waiting for {}", command_clone);

            let res = child.wait();
            if let Ok(exit) = res {
                trace!("{} Exited", command_clone);
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
                if should_control_raw_mode {
                    trace!("Disabling raw mode");
                    disable_raw_mode().expect("Failed to restore non-raw terminal");
                }
                exit_to_process_tx.send(exit.to_string()).ok();
            } else {
                trace!("Error waiting for {}", command_clone);
            };
        });

        trace!("Returning ChildProcess");
        Ok(ChildProcess::new(
            self.parser.clone(),
            self.writer.clone(),
            process_killer,
            self.stdout_rx.clone(),
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
        let mut pseudo_terminal = PseudoTerminal::default().unwrap();
        while i < 10 {
            println!("Running {}", i);
            let cp1 = pseudo_terminal
                .run_command(String::from("whoami"), None, None, None, None, None)
                .unwrap();
            cp1.wait_receiver.recv().unwrap();
            i += 1;
        }
        drop(pseudo_terminal);
    }
}
