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
    quiet: Option<bool>,
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

    let (exit_to_process_tx, exit_to_process_rx) = bounded(1);
    let mut child = pair.slave.spawn_command(cmd)?;
    pseudo_terminal.running.store(true, Ordering::SeqCst);
    trace!("Running {}", command);
    let is_tty = std::io::stdout().is_tty();
    if is_tty {
        trace!("Enabling raw mode");
        enable_raw_mode().expect("Failed to enter raw terminal mode");
    }
    let process_killer = child.clone_killer();

    let running_clone = pseudo_terminal.running.clone();
    let printing_rx = pseudo_terminal.printing_rx.clone();
    std::thread::spawn(move || {
        trace!("Waiting for {}", command);

        let res = child.wait();
        if let Ok(exit) = res {
            trace!("{} Exited", command);
            // This mitigates the issues with ConPTY on windows and makes it work.
            running_clone.store(false, Ordering::SeqCst);
            trace!("Waiting for printing to finish");
            let timeout = 500;
            let a = Instant::now();
            if cfg!(windows) {
                loop {
                    if let Ok(_) = printing_rx.try_recv() {
                        break;
                    }
                    if a.elapsed().as_millis() > timeout {
                        break;
                    }
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
