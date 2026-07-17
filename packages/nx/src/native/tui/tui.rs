use crate::native::tui::lifecycle::TuiMode;
use crate::native::tui::theme::THEME;
use color_eyre::eyre::Result;
use crossterm::{
    cursor,
    event::{self, Event as CrosstermEvent, KeyEvent, KeyEventKind, MouseEvent},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen},
};
use futures::{FutureExt, StreamExt};
use ratatui::backend::CrosstermBackend;
use std::{
    env,
    io::{IsTerminal, Write},
    ops::{Deref, DerefMut},
    time::Duration,
};
use tokio::{
    sync::mpsc::{self, UnboundedReceiver, UnboundedSender},
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;
use tracing::{debug, trace};

pub type Frame<'a> = ratatui::Frame<'a>;
pub type Backend = CrosstermBackend<std::io::Stderr>;

#[derive(Clone, Debug)]
pub enum Event {
    Init,
    Quit,
    Error,
    Closed,
    Tick,
    Render,
    FocusGained,
    FocusLost,
    Paste(String),
    Key(KeyEvent),
    Mouse(MouseEvent),
    Resize(u16, u16),
}

pub struct Tui {
    /// Terminal configured for fullscreen mode (alternate screen)
    pub fullscreen_terminal: ratatui::Terminal<Backend>,
    /// Terminal configured for inline mode (viewport) - created lazily on first use
    pub inline_terminal: Option<ratatui::Terminal<Backend>>,
    pub task: Option<JoinHandle<()>>,
    pub cancellation_token: CancellationToken,
    pub event_rx: UnboundedReceiver<Event>,
    pub event_tx: UnboundedSender<Event>,
    pub frame_rate: f64,
    pub tick_rate: f64,
    pub current_mode: TuiMode,
}

/// DEC private mode sequences for enabling mouse reporting.
///
/// We deliberately enable a narrow set of modes rather than crossterm's bundled
/// `EnableMouseCapture` (which also enables `?1003h`, "any-event" / all-motion
/// tracking). The modes we use:
/// - `?1000h` — normal tracking: button press and release.
/// - `?1002h` — button-event tracking: adds motion reports **while a button is
///   held** (drag). This is what text selection needs; it does NOT report bare
///   hover motion, avoiding a flood of events when the user merely moves the mouse.
/// - `?1006h` — SGR extended coordinates, so columns/rows past 223 are reported
///   correctly and release events are distinguishable.
const ENABLE_MOUSE_CAPTURE_SEQ: &[u8] = b"\x1b[?1000h\x1b[?1002h\x1b[?1006h";
/// Disable sequence — the same modes reset, in reverse order.
const DISABLE_MOUSE_CAPTURE_SEQ: &[u8] = b"\x1b[?1006l\x1b[?1002l\x1b[?1000l";

/// Enable mouse reporting on the terminal (stderr — the same stream the TUI
/// renders to). Idempotent: re-enabling already-enabled modes is a no-op for
/// the terminal.
pub(crate) fn enable_mouse_capture() -> std::io::Result<()> {
    let mut stderr = std::io::stderr();
    stderr.write_all(ENABLE_MOUSE_CAPTURE_SEQ)?;
    stderr.flush()
}

/// Disable mouse reporting on the terminal. Safe to call even when capture was
/// never enabled (the terminal ignores resets for modes that aren't set), so we
/// can call it unconditionally on every teardown path.
pub(crate) fn disable_mouse_capture() -> std::io::Result<()> {
    let mut stderr = std::io::stderr();
    stderr.write_all(DISABLE_MOUSE_CAPTURE_SEQ)?;
    stderr.flush()
}

/// Drain any pending input from stdin to prevent escape sequence leakage.
/// This consumes terminal responses (e.g., from OSC color queries) that may
/// arrive after a query was sent but before the response was fully read.
pub(crate) fn drain_stdin() {
    // Poll and consume any pending terminal events
    // Note: Duration::ZERO can incorrectly return false with use-dev-tty feature
    // See: https://github.com/crossterm-rs/crossterm/issues/839
    while event::poll(Duration::from_millis(5)).unwrap_or(false) {
        let _ = event::read();
    }
}

impl Tui {
    pub fn new() -> Result<Self> {
        Self::new_with_mode(TuiMode::FullScreen)
    }

    pub fn init() -> Result<Self> {
        Self::new_with_mode(TuiMode::FullScreen)
    }

    fn new_with_mode(initial_mode: TuiMode) -> Result<Self> {
        let tick_rate = 10.0;
        let frame_rate = 60.0;

        // Create fullscreen terminal with its own backend
        let fullscreen_terminal = ratatui::Terminal::new(CrosstermBackend::new(std::io::stderr()))?;

        // Only create inline terminal if stdin is a TTY.
        // Inline mode requires cursor position queries (via Viewport::Inline) which use
        // escape sequences that wait for responses on stdin. In git hooks and other
        // non-interactive environments, stdin is redirected so these queries hang.
        // By checking upfront, we avoid flakiness from deferred initialization.
        //
        // IMPORTANT: We must stop the EventStream before creating an Inline viewport
        // because Viewport::Inline queries cursor position, which conflicts with
        // EventStream (both read from stdin). This is handled in enter() and
        // reinitialize_inline_terminal().
        let inline_terminal = if Self::inline_viewport_supported() {
            let size = crossterm::terminal::size();
            debug!("Terminal size: {:?}", size);
            let inline_height = size.map(|(_cols, rows)| rows).unwrap_or(24);
            ratatui::Terminal::with_options(
                CrosstermBackend::new(std::io::stderr()),
                ratatui::TerminalOptions {
                    viewport: ratatui::Viewport::Inline(inline_height),
                },
            )
            .inspect(|_| {
                debug!(
                    "Inline terminal created successfully with height {}",
                    inline_height
                )
            })
            .inspect_err(|e| debug!("Inline terminal not created: {}", e))
            .ok()
        } else {
            debug!("Inline terminal not created: stdin is not a TTY");
            None
        };

        let (event_tx, event_rx) = mpsc::unbounded_channel();
        let cancellation_token = CancellationToken::new();

        Ok(Self {
            fullscreen_terminal,
            inline_terminal,
            task: None,
            cancellation_token,
            event_rx,
            event_tx,
            frame_rate,
            tick_rate,
            current_mode: initial_mode,
        })
    }

    /// Checks if stdin is a proper interactive terminal
    ///
    /// This is critical for avoiding hangs in git hooks and other non-interactive
    /// environments. While stderr may be connected to a terminal (making isTTY true
    /// on the JS side), stdin may be redirected from the hook script. crossterm's
    /// terminal operations send escape sequences and wait for responses on stdin,
    /// which hang indefinitely if stdin isn't a real terminal.
    ///
    /// See: https://github.com/crossterm-rs/crossterm/issues/692
    fn is_stdin_interactive() -> bool {
        std::io::stdin().is_terminal()
    }

    fn is_inline_mode_disabled() -> bool {
        let env = env::var("NX_TUI_INLINE_MODE");
        match env {
            Ok(val) if val == "0" || val.to_lowercase() == "false" => true,
            _ => false,
        }
    }

    fn inline_viewport_supported() -> bool {
        Self::is_stdin_interactive() && !Self::is_inline_mode_disabled()
    }

    pub fn inline_tui_unsupported_reason(&self) -> Option<String> {
        if !Self::is_stdin_interactive() {
            return Some("Stdin is not a TTY".to_string());
        }
        if Self::is_inline_mode_disabled() {
            return Some("NX_TUI_INLINE_MODE is set to false or 0".to_string());
        }
        if !self.inline_terminal.is_some() {
            return Some("Inline terminal failed to initialize".to_string());
        }
        None
    }

    /// Returns a reference to the currently active terminal based on mode
    pub fn terminal(&self) -> &ratatui::Terminal<Backend> {
        match self.current_mode {
            TuiMode::FullScreen => &self.fullscreen_terminal,
            TuiMode::Inline => self
                .inline_terminal
                .as_ref()
                .expect("inline terminal should be initialized before use"),
        }
    }

    /// Returns a mutable reference to the currently active terminal based on mode
    pub fn terminal_mut(&mut self) -> &mut ratatui::Terminal<Backend> {
        match self.current_mode {
            TuiMode::FullScreen => &mut self.fullscreen_terminal,
            TuiMode::Inline => self
                .inline_terminal
                .as_mut()
                .expect("inline terminal should be initialized before use"),
        }
    }

    pub fn tick_rate(&mut self, tick_rate: f64) {
        self.tick_rate = tick_rate;
    }

    pub fn frame_rate(&mut self, frame_rate: f64) {
        self.frame_rate = frame_rate;
    }

    pub fn start(&mut self) {
        let tick_delay = std::time::Duration::from_secs_f64(1.0 / self.tick_rate);
        let render_delay = std::time::Duration::from_secs_f64(1.0 / self.frame_rate);
        self.cancel();
        self.cancellation_token = CancellationToken::new();
        let _cancellation_token = self.cancellation_token.clone();
        let _event_tx = self.event_tx.clone();
        debug!("start(): spawning new event task");
        // Use napi's bindgen_prelude::spawn so this works from any thread
        // (e.g. the JS main thread that calls __init), not only from inside a
        // Tokio runtime context. This lets enter() couple raw-mode entry with
        // EventStream creation synchronously, closing a race where bytes
        // queued in stdin (OSC color-query replies, leftover prompt input)
        // get parsed as keypresses.
        self.task = Some(napi::bindgen_prelude::spawn(async move {
            debug!("Event task spawned - inside async block");
            debug!("Event task: creating EventStream");
            let mut reader = crossterm::event::EventStream::new();
            debug!("Event task: EventStream created successfully");
            let mut tick_interval = tokio::time::interval(tick_delay);
            let mut render_interval = tokio::time::interval(render_delay);
            debug!("Sending Event::Init");
            _event_tx.send(Event::Init).unwrap();
            debug!("Start Listening for Crossterm Events");
            loop {
                let tick_delay = tick_interval.tick();
                let render_delay = render_interval.tick();
                let crossterm_event = reader.next().fuse();

                // NOTE: `biased;` ensures cancellation is checked FIRST every iteration.
                // Without it, tokio::select! randomly picks which branch to check,
                // which can delay cancellation when tick/render intervals are always ready.
                tokio::select! {
                  biased;

                  _ = _cancellation_token.cancelled() => {
                    debug!("Got a cancellation token");
                    break;
                  }
                  _ = tick_delay => {
                      _event_tx.send(Event::Tick).expect("cannot send event");
                  },
                  _ = render_delay => {
                      _event_tx.send(Event::Render).expect("cannot send event");
                  },
                  maybe_event = crossterm_event => {
                    trace!("Maybe Crossterm Event: {:?}", maybe_event);
                    match maybe_event {
                      Some(Ok(evt)) => {
                        trace!("Crossterm Event: {:?}", evt);
                        match evt {
                          CrosstermEvent::Key(key) if key.kind == KeyEventKind::Press => {
                            trace!("Key: {:?}", key);
                            _event_tx.send(Event::Key(key)).unwrap();
                          },
                          CrosstermEvent::Resize(x, y) => {
                            _event_tx.send(Event::Resize(x, y)).unwrap();
                          },
                          CrosstermEvent::FocusLost => {
                            _event_tx.send(Event::FocusLost).unwrap();
                          },
                          CrosstermEvent::FocusGained => {
                            _event_tx.send(Event::FocusGained).unwrap();
                          },
                          CrosstermEvent::Paste(s) => {
                            _event_tx.send(Event::Paste(s)).unwrap();
                          },
                          CrosstermEvent::Mouse(mouse) => {
                            _event_tx.send(Event::Mouse(mouse)).unwrap();
                          },
                          _ => {
                            debug!("Unhandled Crossterm Event: {:?}", evt);
                            continue;
                          }
                        }
                      }
                      Some(Err(e)) => {
                        debug!("Got an error event: {}", e);
                        _event_tx.send(Event::Error).unwrap();
                      }
                      None => {
                        debug!("Crossterm Stream Stoped");
                        break;
                      },
                    }
                  },
                }
            }
            debug!("Crossterm Thread Finished")
        }));
    }

    /// Stop the event loop task.
    ///
    /// This properly yields to the tokio runtime, allowing the inner task
    /// to be polled and see the cancellation token. It's critical that this
    /// method waits for the task to fully finish, because the EventStream
    /// inside the task holds terminal input resources that conflict with
    /// cursor position queries.
    pub async fn stop(&self) -> Result<()> {
        debug!("stop(): cancelling event task");
        self.cancel();
        if let Some(ref task) = self.task {
            let mut counter = 0;
            while !task.is_finished() {
                // IMPORTANT: Use tokio::time::sleep instead of std::thread::sleep!
                // std::thread::sleep blocks the executor thread, preventing the inner
                // task from being polled to see the cancellation token.
                tokio::time::sleep(Duration::from_millis(1)).await;
                counter += 1;
                if counter > 50 && counter % 10 == 0 {
                    // Abort periodically after 50ms in case the task is stuck
                    debug!("stop(): aborting task (attempt at {}ms)", counter);
                    task.abort();
                }
                if counter > 200 {
                    // Give up after 200ms, but log a warning
                    debug!("stop(): WARN - task not finished after 200ms, continuing anyway");
                    break;
                }
            }
            debug!("stop(): event task finished (counter={})", counter);
        }
        Ok(())
    }

    /// Stop the event loop task (blocking version for sync contexts like Drop).
    ///
    /// WARNING: This can cause a 100ms delay if called from within an async task
    /// on a single-threaded runtime, because std::thread::sleep blocks the executor.
    /// Prefer `stop_async()` when in an async context.
    pub fn stop_sync(&self) -> Result<()> {
        self.cancel();
        if let Some(ref task) = self.task {
            let mut counter = 0;
            while !task.is_finished() {
                std::thread::sleep(Duration::from_millis(1));
                counter += 1;
                if counter > 50 {
                    task.abort();
                }
                if counter > 100 {
                    // This timeout is expected when called from sync context on single-threaded runtime
                    debug!(
                        "Failed to abort TUI event loop task after 100ms (expected in sync context)"
                    );
                    break;
                }
            }
        }
        Ok(())
    }

    pub fn enter(&mut self, mode: TuiMode) -> Result<()> {
        // Ensure the theme is set before entering raw mode because it won't work properly once we're in raw mode
        let _ = THEME.is_dark_mode;
        debug!("Enabling Raw Mode for {:?} mode", mode);

        crossterm::terminal::enable_raw_mode()?;

        self.current_mode = mode;

        match mode {
            TuiMode::FullScreen => {
                execute!(std::io::stderr(), EnterAlternateScreen, cursor::Hide)?;
                // Capture the mouse only in fullscreen. This enables scroll-wheel,
                // click and drag handling, at the cost of the terminal's own
                // click-drag text selection (we provide in-app selection instead).
                enable_mouse_capture()?;
            }
            TuiMode::Inline => {
                // Inline terminal must exist (created upfront if stdin is TTY)
                if self.inline_terminal.is_none() {
                    return Err(color_eyre::eyre::eyre!(
                        "Cannot enter inline mode: inline terminal not available (stdin is not a TTY)"
                    ));
                }
                // Inline mode intentionally does NOT capture the mouse: the inline
                // viewport occupies a moving sub-region of the normal scrollback,
                // so absolute mouse coordinates don't map to widgets, and leaving
                // the mouse uncaptured preserves the terminal's native selection.
                execute!(std::io::stderr(), cursor::Hide)?;
                execute!(std::io::stderr(), cursor::MoveTo(0, 0))?;
                execute!(
                    std::io::stderr(),
                    crossterm::terminal::Clear(crossterm::terminal::ClearType::All)
                )?;
            }
        }

        // Start the event reader synchronously so the EventStream exists
        // before we return to the caller. Otherwise any bytes that arrive on
        // stdin between enable_raw_mode() and EventStream::new() (e.g. tail
        // bytes of an OSC 11 color-scheme reply, or leftover input from an
        // interactive prompt that ran just before the TUI) get read as
        // keypresses once the reader finally starts — which manifested as a
        // bogus filter being pre-applied on TUI boot.
        self.start();

        Ok(())
    }

    pub fn restore_terminal(&mut self) -> Result<()> {
        if crossterm::terminal::is_raw_mode_enabled()? {
            self.flush()?;

            // Disable mouse capture before anything else so the terminal stops
            // sending mouse escape sequences. Safe to call unconditionally — the
            // terminal ignores resets for modes that were never set (e.g. inline).
            let _ = disable_mouse_capture();

            // Drain pending terminal responses (e.g., OSC color query responses,
            // and any in-flight mouse reports) to prevent escape sequences from
            // leaking to the terminal on exit
            drain_stdin();

            // Only leave alternate screen if we're in full-screen mode
            match self.current_mode {
                TuiMode::FullScreen => {
                    // Leave alternate screen, then clear the primary buffer and position cursor
                    // This ensures printSummary() has a clean slate to render into
                    execute!(
                        std::io::stderr(),
                        LeaveAlternateScreen,
                        cursor::MoveTo(0, 0),
                        crossterm::terminal::Clear(crossterm::terminal::ClearType::All),
                        cursor::Show
                    )?;
                    std::io::stderr().flush()?;
                }
                TuiMode::Inline => {
                    // For inline mode, just show cursor (no alternate screen to leave)
                    execute!(std::io::stderr(), cursor::MoveTo(0, 0), cursor::Show)?;
                    // Ensure cursor is actually shown by flushing stderr
                    std::io::stderr().flush()?;
                }
            }

            crossterm::terminal::disable_raw_mode()?;
        }
        Ok(())
    }

    /// Exit the TUI.
    ///
    /// This properly yields to the runtime while waiting for the event loop task to stop.
    pub async fn exit(&mut self) -> Result<()> {
        self.stop().await?;
        self.restore_terminal()?;
        Ok(())
    }

    /// Exit the TUI (sync version - for Drop and panic handlers).
    ///
    /// WARNING: Can cause 100ms delay on single-threaded runtimes.
    pub fn exit_sync(&mut self) -> Result<()> {
        self.stop_sync()?;
        self.restore_terminal()?;
        Ok(())
    }

    pub async fn switch_mode(&mut self, new_mode: TuiMode) -> Result<()> {
        if new_mode == self.current_mode {
            debug!("Mode {:?} is already active", new_mode);
            return Ok(());
        }

        debug!(
            "Switching mode from {:?} to {:?}",
            self.current_mode, new_mode
        );

        // Ensure the inline terminal exists before touching any terminal state, so
        // a refusal leaves us cleanly in the current mode.
        if new_mode == TuiMode::Inline && self.inline_terminal.is_none() {
            return Err(color_eyre::eyre::eyre!(
                "Cannot switch to inline mode: inline terminal not available (stdin is not a TTY)"
            ));
        }

        let previous_mode = self.current_mode;

        // Clean up current mode's terminal state (but stay in raw mode)
        match previous_mode {
            TuiMode::FullScreen => {
                // Leave alternate screen but stay in raw mode
                execute!(std::io::stderr(), LeaveAlternateScreen)?;
            }
            TuiMode::Inline => {
                // Just show cursor temporarily
                execute!(std::io::stderr(), cursor::Show)?;
            }
        }

        // Switch the mode
        self.current_mode = new_mode;

        // Set up new mode's terminal state (we're still in raw mode)
        match new_mode {
            TuiMode::FullScreen => {
                // Coming from inline, clearing the terminal still triggers ratatui's
                // cursor-position query, which races stdin and intermittently times
                // out (the same hazard the inline direction has). Stop the input
                // event stream around it so the switch back can't fail and bounce the
                // user to a second Esc.
                self.stop().await?;
                tokio::time::sleep(Duration::from_millis(10)).await;
                // Clear the new terminal's buffers to force a full redraw
                self.terminal_mut().clear()?;
                execute!(std::io::stderr(), EnterAlternateScreen, cursor::Hide)?;
                // Capture the mouse in fullscreen (NXC-3945).
                enable_mouse_capture()?;
                // Fresh event channel + restart, mirroring reinitialize_inline_terminal.
                let (new_tx, new_rx) = mpsc::unbounded_channel();
                self.event_tx = new_tx;
                self.event_rx = new_rx;
                self.start();
                tokio::task::yield_now().await;
            }
            TuiMode::Inline => {
                // Recreate the inline viewport with the input event stream stopped,
                // so its cursor-position query can't race stdin and time out — the
                // same hazard the resize path handles. Querying the cursor here while
                // the EventStream is live is what intermittently failed and left the
                // terminal half-switched ("neither mode") before the run quit.
                if let Err(e) = self.reinitialize_inline_terminal().await {
                    // Roll the terminal back to the mode we came from so we never
                    // surface a half-switched ("neither") terminal to the caller.
                    // (Mouse capture is released only after this point, so the
                    // fullscreen rollback still has the mouse captured.)
                    self.current_mode = previous_mode;
                    if previous_mode == TuiMode::FullScreen {
                        let _ = execute!(std::io::stderr(), EnterAlternateScreen, cursor::Hide);
                        let _ = self.terminal_mut().clear();
                    }
                    return Err(e);
                }
                // Release the mouse when dropping to inline (NXC-3944) so the
                // terminal regains native scroll/selection in the inline viewport.
                disable_mouse_capture()?;
                execute!(std::io::stderr(), cursor::Hide)?;
            }
        }

        debug!("Switched to {:?} mode", new_mode);
        Ok(())
    }

    /// Reinitialize the inline terminal with the current terminal dimensions.
    ///
    /// The inline terminal's viewport height is fixed at creation time. When the
    /// terminal is resized, we need to recreate the inline terminal with the new
    /// dimensions rather than trying to resize an existing viewport (which doesn't
    /// work well with ratatui's Inline viewport).
    ///
    /// This method:
    /// 1. Stops the event stream task to avoid conflicts with cursor queries
    /// 2. Clears the current viewport content
    /// 3. Creates a new inline terminal with current dimensions
    /// 4. Restarts the event stream task
    ///
    /// Note: Callers should debounce resize events before calling this method
    /// to avoid rapid reinitialization during window drag operations.
    pub async fn reinitialize_inline_terminal(&mut self) -> Result<()> {
        if let Some(reason) = self.inline_tui_unsupported_reason() {
            return Err(color_eyre::eyre::eyre!(
                "Cannot reinitialize inline terminal: {}",
                reason
            ));
        }
        debug!("Reinitializing inline terminal");

        // Stop the event stream task. This is CRITICAL because ratatui's Inline
        // viewport queries cursor position, which conflicts with crossterm's
        // EventStream reading from the same terminal input.
        // See: https://docs.rs/crossterm/latest/crossterm/event/index.html
        // "cursor::position() will block while EventStream is active"
        self.stop().await?;
        debug!("Event stream stopped");

        // Small delay to let crossterm's internal state fully settle.
        // This helps ensure the old EventStream's resources are released
        // before we query cursor position for the new Inline viewport.
        tokio::time::sleep(Duration::from_millis(10)).await;

        // Clear the current inline viewport before recreating
        // This prevents the old content from being "baked" into the terminal output
        execute!(
            std::io::stderr(),
            cursor::MoveTo(0, 0),
            crossterm::terminal::Clear(crossterm::terminal::ClearType::FromCursorDown)
        )?;

        // Get current terminal dimensions
        let (cols, rows) = crossterm::terminal::size().unwrap_or((80, 24));
        debug!(
            "Creating new inline terminal with dimensions: {}x{}",
            cols, rows
        );

        // Create new inline terminal with current dimensions.
        // We use Viewport::Inline for insert_before scrollback support.
        // The cursor position query happens here, which is safe because we
        // stopped the EventStream above.
        self.inline_terminal = Some(ratatui::Terminal::with_options(
            CrosstermBackend::new(std::io::stderr()),
            ratatui::TerminalOptions {
                viewport: ratatui::Viewport::Inline(rows),
            },
        )?);

        // Create a fresh event channel to ensure no stale state from the old task
        let (new_tx, new_rx) = mpsc::unbounded_channel();
        self.event_tx = new_tx;
        self.event_rx = new_rx;
        debug!("Created fresh event channel");

        // Restart the event stream with the new channel
        debug!("About to call start()");
        self.start();
        debug!("start() returned, yielding to allow new task to run");
        // Yield to let the new event task get scheduled and start running
        tokio::task::yield_now().await;
        debug!("Inline terminal reinitialized, event stream restarted");
        Ok(())
    }

    /// Draw to the terminal without calling autoresize().
    ///
    /// This is critical for inline mode because ratatui's normal draw() calls
    /// autoresize(), which queries cursor position. The cursor position query
    /// conflicts with crossterm's EventStream (both read from stdin), causing
    /// hangs in inline mode.
    ///
    /// This method:
    /// 1. Gets a frame without calling autoresize()
    /// 2. Renders widgets to the frame
    /// 3. Flushes the diff to the backend
    /// 4. Swaps buffers for the next frame
    ///
    /// Use this instead of tui.draw() in inline mode to avoid cursor conflicts.
    pub fn draw_without_autoresize<F>(&mut self, f: F) -> Result<()>
    where
        F: FnOnce(&mut Frame<'_>),
    {
        let terminal = self.terminal_mut();
        {
            let mut frame = terminal.get_frame();
            f(&mut frame);
        }
        terminal.flush()?;
        terminal.swap_buffers();
        Ok(())
    }

    pub fn cancel(&self) {
        self.cancellation_token.cancel();
    }

    pub async fn next(&mut self) -> Option<Event> {
        self.event_rx.recv().await
    }
}

impl Deref for Tui {
    type Target = ratatui::Terminal<Backend>;

    fn deref(&self) -> &Self::Target {
        self.terminal()
    }
}

impl DerefMut for Tui {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.terminal_mut()
    }
}

impl Drop for Tui {
    fn drop(&mut self) {
        // NOTE: Drop cannot be async, so we use the sync version here.
        // This may cause a 100ms delay on single-threaded runtimes, but Drop
        // is typically called during cleanup when the delay is less noticeable.
        // The main event loop should use exit_async() for proper cleanup.
        self.exit_sync().unwrap();
    }
}
