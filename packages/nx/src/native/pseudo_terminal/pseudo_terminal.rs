use anyhow::anyhow;
use crossbeam_channel::{Receiver, Sender, bounded, unbounded};
use crossterm::{
    terminal,
    terminal::{disable_raw_mode, enable_raw_mode},
    tty::IsTty,
};
use napi::bindgen_prelude::*;
use parking_lot::{Mutex, RwLock};
use portable_pty::{
    CommandBuilder, MasterPty, NativePtySystem, PtyPair, PtySize, PtySystem, SlavePty,
};
use std::io::stdout;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tracing::debug;
use tracing::log::trace;
use vt100_ctt::Parser;

use super::os;
use crate::native::pseudo_terminal::{child_process::ChildProcess, process_killer::ProcessKiller};

pub enum PtyOutput {
    CommandHeader(String),
    Process(String),
}

/// One open pty. `slave` is listed before `master` so it is dropped first,
/// matching the drop order PtyPair documents and relies on.
struct OpenPty {
    slave: Box<dyn SlavePty + Send>,
    master: MasterArc,
    writer: WriterArc,
    reader_finished: Receiver<()>,
}

struct PtyInner {
    open: Option<OpenPty>,
    live_children: usize,
}

pub struct PseudoTerminal {
    inner: Arc<Mutex<PtyInner>>,
    stdout_tx: Sender<PtyOutput>,
    stdout_rx: Receiver<PtyOutput>,
    printing_tx: Sender<()>,
    printing_rx: Receiver<()>,
    quiet: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    parser: ParserArc,
    /// Stdin passthrough reads this on every chunk, so a pty opened for a
    /// later command still receives input after the previous one was closed.
    live_writer: LiveWriter,
    is_within_nx_tui: bool,
    size: (u16, u16),
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
pub type LiveWriter = Arc<RwLock<Option<WriterArc>>>;
/// The control end of the pty. Resizing it issues the TIOCSWINSZ ioctl, which
/// updates the winsize the kernel reports to the child and raises SIGWINCH so
/// the child knows to redraw at the new dimensions.
///
/// `None` after the command exits and the master fd has been closed. Holders
/// (the child-process handle, the TUI) keep the `Arc` but no longer keep the
/// fd.
pub type MasterArc = Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>;

/// The handles the TUI needs to display and drive a running pty task: the parser
/// it renders from, the writer it forwards input to, and the master it resizes.
pub type PtyHandles = (ParserArc, WriterArc, MasterArc);

/// Resize the pty so the child process is told its window changed.
pub fn resize_master(master: &MasterArc, rows: u16, cols: u16) {
    let guard = master.lock();
    let Some(master) = guard.as_ref() else {
        return;
    };
    if let Err(e) = master.resize(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        debug!("Failed to resize pty to {}x{}: {}", rows, cols, e);
    }
}

impl PseudoTerminal {
    pub fn new(options: PseudoTerminalOptions) -> Result<Self> {
        let quiet = Arc::new(AtomicBool::new(true));
        let running = Arc::new(AtomicBool::new(false));
        let (stdout_tx, stdout_rx) = unbounded();
        let (printing_tx, printing_rx) = unbounded();
        let (cols, rows) = options.size;
        // Scrollback size matches PtyInstance::SCROLLBACK_SIZE (1000 rows).
        // Larger values make resize reparse and all_contents_formatted() more
        // expensive, which blocks the parser write lock and starves rendering.
        const SCROLLBACK_SIZE: usize = 1000;
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, SCROLLBACK_SIZE)));
        let is_within_nx_tui =
            std::env::var("NX_TUI").unwrap_or_else(|_| String::from("false")) == "true";
        let live_writer = Arc::new(RwLock::new(None));
        let inner = Arc::new(Mutex::new(PtyInner {
            open: None,
            live_children: 0,
        }));

        let pty = PseudoTerminal {
            inner,
            stdout_tx,
            stdout_rx,
            printing_tx,
            printing_rx,
            quiet,
            running,
            parser,
            live_writer,
            is_within_nx_tui,
            size: (cols, rows),
        };
        {
            // Open before returning so the stdin thread has a writer to target.
            let _guard = lock_ready_pty(&pty)?;
        }

        if !is_within_nx_tui && stdout().is_tty() {
            // Stdin -> pty stdin
            trace!("Passing through stdin");
            let live_writer = pty.live_writer.clone();
            std::thread::spawn(move || {
                let mut stdin = std::io::stdin();
                if let Err(e) = os::write_to_pty(&mut stdin, live_writer) {
                    trace!("Error writing to pty: {:?}", e);
                }
            });
        }

        Ok(pty)
    }

    /// Release the pty master and slave file descriptors. Idempotent, and a
    /// no-op while a command is still running.
    pub fn shutdown(&mut self) {
        let open = {
            let mut inner = self.inner.lock();
            if inner.live_children > 0 {
                return;
            }
            inner.open.take()
        };
        if let Some(open) = open {
            close_open_pty(open, &self.live_writer);
        }
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
        self.stdout_tx
            .send(PtyOutput::CommandHeader(command_info.clone()))
            .ok();

        if self.is_within_nx_tui {
            // within the tui, update the parser directly so it is displayed in the tui
            self.parser.write().process(command_info.as_bytes());
        } else if !quiet {
            // outside the tui, just print to stdout so the user can see it
            if let Err(e) = std::io::stdout().write_all(command_info.as_bytes()) {
                debug!("Failed to write command info to stdout: {}", e);
            }
        }

        trace!("Running {}", command_clone);
        let spawn_result = {
            let mut inner = lock_ready_pty(self)?;
            inner.live_children += 1;
            let spawned = inner
                .open
                .as_ref()
                .expect("pty opened above")
                .slave
                .spawn_command(cmd);
            match spawned {
                Ok(child) => {
                    let open = inner.open.as_ref().expect("pty opened above");
                    Ok((child, open.master.clone(), open.writer.clone()))
                }
                Err(err) => {
                    inner.live_children -= 1;
                    let open = if inner.live_children == 0 {
                        inner.open.take()
                    } else {
                        None
                    };
                    Err((err, open))
                }
            }
        };
        let (mut child, master, writer) = match spawn_result {
            Ok(spawned) => spawned,
            Err((err, open)) => {
                if let Some(open) = open {
                    close_open_pty(open, &self.live_writer);
                }
                return Err(err.into());
            }
        };
        self.running.store(true, Ordering::SeqCst);

        let is_tty = tty.unwrap_or_else(|| std::io::stdout().is_tty());
        // Do not manipulate raw mode if running within the context of the NX_TUI, it handles it itself
        let should_control_raw_mode = is_tty && !self.is_within_nx_tui;
        if should_control_raw_mode {
            trace!("Enabling raw mode");
            enable_raw_mode().expect("Failed to enter raw terminal mode");
        }
        let pid = child
            .process_id()
            .expect("unable to determine child process id") as i32;
        let process_killer = ProcessKiller::new(pid);

        trace!("Getting running clone");
        let running_clone = self.running.clone();
        trace!("Getting printing_rx clone");
        let printing_rx = self.printing_rx.clone();
        let inner = self.inner.clone();
        let live_writer = self.live_writer.clone();

        trace!("spawning thread to wait for command");
        std::thread::spawn(move || {
            trace!("Waiting for {}", command_clone);

            let res = child.wait();
            // Take the pty out while holding the child count, so a command
            // that starts in between cannot be handed the pty we are about
            // to close.
            let open = {
                let mut inner = inner.lock();
                inner.live_children = inner.live_children.saturating_sub(1);
                if inner.live_children == 0 {
                    inner.open.take()
                } else {
                    None
                }
            };
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
                    // Must not panic: that would skip the exit notification below,
                    // leaving every consumer of this task's exit waiting forever.
                    if let Err(e) = disable_raw_mode() {
                        trace!("Failed to restore non-raw terminal: {:?}", e);
                    }
                }
                if let Some(open) = open {
                    close_open_pty(open, &live_writer);
                }
                exit_to_process_tx.send(exit.to_string()).ok();
            } else {
                trace!("Error waiting for {}", command_clone);
                if let Some(open) = open {
                    close_open_pty(open, &live_writer);
                }
            };
        });

        trace!("Returning ChildProcess");
        Ok(ChildProcess::new(
            self.parser.clone(),
            writer,
            master,
            pid,
            process_killer,
            self.stdout_rx.clone(),
            exit_to_process_rx,
        ))
    }
}

impl Drop for PseudoTerminal {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn lock_ready_pty(pty: &PseudoTerminal) -> napi::Result<parking_lot::MutexGuard<'_, PtyInner>> {
    let size = pty.size;
    let parser = pty.parser.clone();
    let quiet = pty.quiet.clone();
    let running = pty.running.clone();
    let stdout_tx = pty.stdout_tx.clone();
    let printing_tx = pty.printing_tx.clone();
    let live_writer = pty.live_writer.clone();
    let is_within_nx_tui = pty.is_within_nx_tui;
    let mut inner = pty.inner.lock();
    if inner.open.is_none() {
        trace!("Opening Pseudo Terminal");
        inner.open = Some(create_open_pty(
            size,
            &live_writer,
            PtyReadState {
                parser,
                quiet,
                running,
                stdout_tx,
                printing_tx,
                is_within_nx_tui,
            },
        )?);
    }
    Ok(inner)
}

struct PtyReadState {
    parser: ParserArc,
    quiet: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    stdout_tx: Sender<PtyOutput>,
    printing_tx: Sender<()>,
    is_within_nx_tui: bool,
}

fn create_open_pty(
    size: (u16, u16),
    live_writer: &LiveWriter,
    read: PtyReadState,
) -> napi::Result<OpenPty> {
    let PtyReadState {
        parser,
        quiet,
        running,
        stdout_tx,
        printing_tx,
        is_within_nx_tui,
    } = read;
    let (cols, rows) = size;
    let PtyPair { slave, master } = NativePtySystem::default().openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let writer = master.take_writer()?;
    let writer_arc: WriterArc = Arc::new(Mutex::new(writer));
    *live_writer.write() = Some(writer_arc.clone());
    let reader = master.try_clone_reader()?;
    let master_arc: MasterArc = Arc::new(Mutex::new(Some(master)));
    let reader_finished = spawn_output_reader(
        reader,
        is_within_nx_tui,
        parser,
        stdout_tx,
        quiet,
        running,
        printing_tx,
    );
    Ok(OpenPty {
        slave,
        master: master_arc,
        writer: writer_arc,
        reader_finished,
    })
}

fn close_open_pty(open: OpenPty, live_writer: &LiveWriter) {
    // Dropping the slave unblocks the reader (EOF / EIO). The reader owns a
    // cloned master fd, so it has to exit before every master fd is closed.
    drop(open.slave);
    if open
        .reader_finished
        .recv_timeout(Duration::from_millis(500))
        .is_err()
    {
        trace!("pty reader thread did not exit before the master fd was closed");
    }
    *live_writer.write() = None;
    let closed: Box<dyn Write + Send> = Box::new(std::io::sink());
    *open.writer.lock() = closed;
    *open.master.lock() = None;
}

fn spawn_output_reader(
    mut reader: impl Read + Send + 'static,
    is_within_nx_tui: bool,
    parser: ParserArc,
    stdout_tx: Sender<PtyOutput>,
    quiet: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    printing_tx: Sender<()>,
) -> Receiver<()> {
    let (done_tx, done_rx) = bounded(1);
    std::thread::spawn(move || {
        let mut stdout = std::io::stdout();
        let mut buf = [0; 8 * 1024];
        // Local buffer for batching parser writes when inside the TUI.
        // Under firehose output, reader.read() returns a full 8KB buffer
        // on every call. Without batching, the parser write lock is
        // acquired on every 8KB chunk, leaving almost no gap for the
        // rendering thread's try_read(). By accumulating locally and
        // only flushing when the read returns short (PTY caught up) or
        // the buffer exceeds a threshold, we reduce lock acquisitions
        // and give rendering predictable windows to read.
        let mut pending_tui_buf: Vec<u8> = Vec::new();
        const BATCH_THRESHOLD: usize = 64 * 1024;
        // Scrollback size matches PtyInstance::SCROLLBACK_SIZE (1000 rows).
        const SCROLLBACK_SIZE: usize = 1000;
        // When raw output exceeds this threshold, compact the parser to prevent
        // unbounded Vec growth. Without this, extend_from_slice() eventually
        // triggers multi-hundred-millisecond reallocs under the write lock,
        // causing the TUI to hang progressively worse as output accumulates.
        const MAX_RAW_OUTPUT_BYTES: usize = 5 * 1024 * 1024; // 5 MB
        // Filters reply-eliciting escape sequences out of the captured
        // copy only — the live stdout passthrough and the TUI parser get
        // raw bytes, so a running child still talks to the real terminal.
        let mut capture_filter = super::strip_queries::QueryFilter::new();
        let mut capture_decoder = super::utf8_carry::Utf8Carry::default();

        'read_loop: loop {
            if let Ok(len) = reader.read(&mut buf) {
                if len == 0 {
                    // EOF — flush any remaining buffered data before exiting
                    if is_within_nx_tui && !pending_tui_buf.is_empty() {
                        let mut parser = parser.write();
                        parser.process(&pending_tui_buf);
                        pending_tui_buf.clear();
                    }
                    let mut held = capture_decoder.feed(&capture_filter.flush());
                    held.push_str(&capture_decoder.flush());
                    if !held.is_empty() {
                        stdout_tx.send(PtyOutput::Process(held)).ok();
                    }
                    break;
                }
                let captured = capture_decoder.feed(&capture_filter.feed(&buf[0..len]));
                if !captured.is_empty() {
                    stdout_tx.send(PtyOutput::Process(captured)).ok();
                }
                let quiet = quiet.load(Ordering::Relaxed);
                trace!("Quiet: {}", quiet);
                debug!("Read {} bytes", len);
                if is_within_nx_tui {
                    trace!("Processing data via vt100 for use in tui");
                    pending_tui_buf.extend_from_slice(&buf[..len]);
                    // Batch: only take the parser write lock when the PTY
                    // reader has caught up (short read) or we've accumulated
                    // enough data. Under firehose output, full-buffer reads
                    // (len == buf.len()) indicate more data is immediately
                    // available, so we defer processing. Short reads mean
                    // we've drained the PTY buffer and the next read will
                    // block, giving us a natural processing window.
                    let should_flush = len < buf.len() || pending_tui_buf.len() >= BATCH_THRESHOLD;
                    if should_flush {
                        let mut parser = parser.write();
                        parser.process(&pending_tui_buf);
                        pending_tui_buf.clear();
                        // Compact when raw output grows too large. Replays
                        // the formatted screen state (bounded by SCROLLBACK_SIZE)
                        // through a fresh parser, keeping raw_output small.
                        if parser.get_raw_output().len() > MAX_RAW_OUTPUT_BYTES {
                            let screen = parser.screen();
                            let (rows, cols) = screen.size();
                            let formatted = screen.all_contents_formatted();
                            let scrollback = screen.scrollback();
                            let mut compacted = Parser::new(rows, cols, SCROLLBACK_SIZE);
                            compacted.process(&formatted);
                            compacted.screen_mut().set_scrollback(scrollback);
                            *parser = compacted;
                        }
                    }
                }

                if !quiet {
                    let mut logged_interrupted_error = false;

                    let mut content = String::from_utf8_lossy(&buf[0..len]).to_string();
                    if content.contains("\x1B[6n") {
                        trace!("Prevented terminal escape sequence ESC[6n from being printed.");
                        content = content.replace("\x1B[6n", "");
                    }

                    let write_buf = content.as_bytes();
                    debug!("Escaped Stdout: {:?}", write_buf.escape_ascii().to_string());

                    while let Err(e) = stdout.write_all(write_buf) {
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
            if !running.load(Ordering::SeqCst) {
                printing_tx.send(()).ok();
            }
        }

        printing_tx.send(()).ok();
        let _ = done_tx.send(());
    });
    done_rx
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
    #[ignore] // hangs on Windows
    fn can_run_commands() {
        let mut i = 0;
        let mut pseudo_terminal = PseudoTerminal::new(PseudoTerminalOptions::default()).unwrap();
        while i < 10 {
            println!("Running {}", i);
            let cp1 = pseudo_terminal
                .run_command(String::from("whoami"), None, None, None, None, None, None)
                .unwrap();
            cp1.wait_receiver.recv().unwrap();
            i += 1;
        }
        drop(pseudo_terminal);
    }
}

#[cfg(all(test, target_os = "linux"))]
mod fd_tests {
    use std::collections::HashSet;
    use std::time::Duration;

    use super::*;

    fn pty_fds() -> HashSet<i32> {
        let mut fds = HashSet::new();
        let Ok(entries) = std::fs::read_dir("/proc/self/fd") else {
            return fds;
        };
        for entry in entries.flatten() {
            let Ok(name) = entry.file_name().into_string() else {
                continue;
            };
            let Ok(fd) = name.parse::<i32>() else {
                continue;
            };
            let Ok(target) = std::fs::read_link(entry.path()) else {
                continue;
            };
            let target = target.to_string_lossy();
            if target.contains("ptmx") || target.contains("/pts/") {
                fds.insert(fd);
            }
        }
        fds
    }

    fn run_true(pty: &mut PseudoTerminal) -> String {
        let child = pty
            .run_command(
                String::from("true"),
                None,
                None,
                None,
                Some(true),
                Some(false),
                None,
            )
            .unwrap();
        let status = child
            .wait_receiver
            .recv_timeout(Duration::from_secs(5))
            .expect("command did not exit");
        // Keep the child alive for the rest of the test so fd release cannot
        // be explained by ChildProcess being dropped.
        std::mem::forget(child);
        status
    }

    #[test]
    fn pty_fds_close_when_the_command_exits_without_dropping_the_terminal() {
        let before_open = pty_fds();
        let probe = PseudoTerminal::new(PseudoTerminalOptions::default()).unwrap();
        let opened: Vec<i32> = pty_fds().difference(&before_open).copied().collect();
        assert!(
            !opened.is_empty(),
            "PseudoTerminal::new did not open a pty fd; the counter cannot see the leak"
        );
        drop(probe);
        let still_open: Vec<i32> = opened
            .into_iter()
            .filter(|fd| pty_fds().contains(fd))
            .collect();
        assert!(
            still_open.is_empty(),
            "dropping an idle terminal left pty fds open: {still_open:?}"
        );

        let baseline = pty_fds();
        let mut kept = Vec::new();
        for _ in 0..8 {
            let mut pty = PseudoTerminal::new(PseudoTerminalOptions::default()).unwrap();
            assert_eq!(run_true(&mut pty), "Success");
            assert_eq!(run_true(&mut pty), "Success");
            kept.push(pty);
        }
        let leaked: Vec<i32> = pty_fds().difference(&baseline).copied().collect();
        assert!(
            leaked.is_empty(),
            "finished commands left pty fds open while the terminal was still held: {leaked:?}"
        );
        drop(kept);
    }
}
