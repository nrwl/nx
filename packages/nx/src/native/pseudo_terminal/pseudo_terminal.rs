use std::{
    collections::HashMap,
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
use portable_pty::{CommandBuilder, NativePtySystem, PtyPair, PtySize, PtySystem};
use tracing::log::trace;

use super::os;
use crate::native::pseudo_terminal::child_process::ChildProcess;

pub struct PseudoTerminal {
    pub pty_pair: PtyPair,
    pub message_rx: Receiver<String>,
    pub printing_rx: Receiver<()>,
    pub quiet: Arc<AtomicBool>,
    pub running: Arc<AtomicBool>,
}

pub fn create_pseudo_terminal() -> napi::Result<PseudoTerminal> {
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
    // Why do we do this here when it's already done when running a command?
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
                    let mut content = String::from_utf8_lossy(&buf[0..len]).to_string();
                    if content.contains("\x1B[6n") {
                        trace!("Prevented terminal escape sequence ESC[6n from being printed.");
                        content = content.replace("\x1B[6n", "");
                    }
                    let mut logged_interrupted_error = false;
                    while let Err(e) = stdout.write_all(content.as_bytes()) {
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
    if std::io::stdout().is_tty() {
        trace!("Disabling raw mode");
        disable_raw_mode().expect("Failed to exit raw terminal mode");
    }
    Ok(PseudoTerminal {
        quiet,
        running,
        pty_pair,
        message_rx,
        printing_rx,
    })
}
pub fn run_command(
    pseudo_terminal: &PseudoTerminal,
    command: String,
    command_dir: Option<String>,
    js_env: Option<HashMap<String, String>>,
    exec_argv: Option<Vec<String>>,
    quiet: Option<bool>,
    tty: Option<bool>,
) -> napi::Result<ChildProcess> {
    let command_dir = get_directory(command_dir)?;

    let pair = &pseudo_terminal.pty_pair;

    let quiet = quiet.unwrap_or(false);

    pseudo_terminal.quiet.store(quiet, Ordering::Relaxed);

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
    let mut child = pair.slave.spawn_command(cmd)?;
    pseudo_terminal.running.store(true, Ordering::SeqCst);
    trace!("Running {}", command);
    let is_tty = tty.unwrap_or_else(|| std::io::stdout().is_tty());
    if is_tty {
        trace!("Enabling raw mode");
        enable_raw_mode().expect("Failed to enter raw terminal mode");
    }
    let process_killer = child.clone_killer();

    trace!("Getting running clone");
    let running_clone = pseudo_terminal.running.clone();
    trace!("Getting printing_rx clone");
    let printing_rx = pseudo_terminal.printing_rx.clone();

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
        pseudo_terminal.message_rx.clone(),
        exit_to_process_rx,
    ))
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
        let pseudo_terminal = create_pseudo_terminal().unwrap();
        while i < 10 {
            println!("Running {}", i);
            let cp1 =
                run_command(&pseudo_terminal, String::from("whoami"), None, None, None).unwrap();
            cp1.wait_receiver.recv().unwrap();
            i += 1;
        }
        drop(pseudo_terminal);
    }
}
