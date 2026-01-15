use crate::native::tui::lifecycle::TuiMode;
use crate::native::tui::theme::THEME;
use color_eyre::eyre::Result;
use crossterm::{
    cursor,
    event::{self, Event as CrosstermEvent, KeyEvent, KeyEventKind},
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
    Resize(u16, u16),
}

pub struct Tui {
    /// Terminal configured for fullscreen mode (alternate screen)
    pub fullscreen_terminal: ratatui::Terminal<Backend>,
    /// Terminal configured for inline mode (viewport) - created lazily on first use
    pub inline_terminal: Option<ratatui::Terminal<Backend>>,
    pub task: JoinHandle<()>,
    pub cancellation_token: CancellationToken,
    pub event_rx: UnboundedReceiver<Event>,
    pub event_tx: UnboundedSender<Event>,
    pub frame_rate: f64,
    pub tick_rate: f64,
    pub current_mode: TuiMode,
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
        let inline_terminal = if Self::inline_viewport_supported() {
            let inline_height = crossterm::terminal::size()
                .map(|(_cols, rows)| rows)
                .unwrap_or(24);
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
        let task = tokio::spawn(async {});

        Ok(Self {
            fullscreen_terminal,
            inline_terminal,
            task,
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
        self.task = tokio::spawn(async move {
            let mut reader = crossterm::event::EventStream::new();
            let mut tick_interval = tokio::time::interval(tick_delay);
            let mut render_interval = tokio::time::interval(render_delay);
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
        });
    }

    /// Stop the event loop task.
    ///
    /// This properly yields to the tokio runtime, allowing the inner task
    /// to be polled and see the cancellation token.
    pub async fn stop(&self) -> Result<()> {
        self.cancel();
        let mut counter = 0;
        while !self.task.is_finished() {
            // IMPORTANT: Use tokio::time::sleep instead of std::thread::sleep!
            // std::thread::sleep blocks the executor thread, preventing the inner
            // task from being polled to see the cancellation token.
            tokio::time::sleep(Duration::from_millis(1)).await;
            counter += 1;
            if counter > 50 {
                self.task.abort();
            }
            if counter > 100 {
                debug!("Failed to abort TUI event loop task after 100ms, moving on anyway");
                break;
            }
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
        let mut counter = 0;
        while !self.task.is_finished() {
            std::thread::sleep(Duration::from_millis(1));
            counter += 1;
            if counter > 50 {
                self.task.abort();
            }
            if counter > 100 {
                // This timeout is expected when called from sync context on single-threaded runtime
                debug!(
                    "Failed to abort TUI event loop task after 100ms (expected in sync context)"
                );
                break;
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
            }
            TuiMode::Inline => {
                // Inline terminal must exist (created upfront if stdin is TTY)
                if self.inline_terminal.is_none() {
                    return Err(color_eyre::eyre::eyre!(
                        "Cannot enter inline mode: inline terminal not available (stdin is not a TTY)"
                    ));
                }
                execute!(std::io::stderr(), cursor::Hide)?;
                execute!(std::io::stderr(), cursor::MoveTo(0, 0))?;
                execute!(
                    std::io::stderr(),
                    crossterm::terminal::Clear(crossterm::terminal::ClearType::All)
                )?;
            }
        }

        self.start();
        Ok(())
    }

    pub fn restore_terminal(&mut self) -> Result<()> {
        if crossterm::terminal::is_raw_mode_enabled()? {
            self.flush()?;

            // Drain pending terminal responses (e.g., OSC color query responses)
            // to prevent escape sequences from leaking to the terminal on exit
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

    pub fn switch_mode(&mut self, new_mode: TuiMode) -> Result<()> {
        if new_mode == self.current_mode {
            debug!("Mode {:?} is already active", new_mode);
            return Ok(());
        }

        debug!(
            "Switching mode from {:?} to {:?}",
            self.current_mode, new_mode
        );

        // Clean up current mode's terminal state (but stay in raw mode)
        match self.current_mode {
            TuiMode::FullScreen => {
                // Leave alternate screen but stay in raw mode
                execute!(std::io::stderr(), LeaveAlternateScreen)?;
            }
            TuiMode::Inline => {
                // Just show cursor temporarily
                execute!(std::io::stderr(), cursor::Show)?;
            }
        }

        // Ensure inline terminal exists before switching to it
        if new_mode == TuiMode::Inline && self.inline_terminal.is_none() {
            return Err(color_eyre::eyre::eyre!(
                "Cannot switch to inline mode: inline terminal not available (stdin is not a TTY)"
            ));
        }

        // Switch the mode
        self.current_mode = new_mode;

        // Clear the new terminal's buffers to force a full redraw
        self.terminal_mut().clear()?;

        // Set up new mode's terminal state (we're still in raw mode)
        match new_mode {
            TuiMode::FullScreen => {
                execute!(std::io::stderr(), EnterAlternateScreen, cursor::Hide)?;
            }
            TuiMode::Inline => {
                execute!(std::io::stderr(), cursor::Hide)?;
                execute!(std::io::stderr(), cursor::MoveTo(0, 0))?;
                execute!(
                    std::io::stderr(),
                    crossterm::terminal::Clear(crossterm::terminal::ClearType::All)
                )?;
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
    /// 1. Stops the event stream task (async, allowing proper cleanup)
    /// 2. Creates a new inline terminal with current dimensions
    /// 3. Restarts the event stream task
    ///
    /// Note: Callers should debounce resize events before calling this method
    /// to avoid rapid reinitialization during window drag operations.
    pub async fn reinitialize_inline_terminal(&mut self) -> Result<()> {
        debug!("Reinitializing inline terminal");

        // Stop the event stream to ensure clean state
        self.stop().await?;

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

        // Create new inline terminal with current dimensions
        self.inline_terminal = Some(ratatui::Terminal::with_options(
            CrosstermBackend::new(std::io::stderr()),
            ratatui::TerminalOptions {
                viewport: ratatui::Viewport::Inline(rows),
            },
        )?);

        // Restart the event stream
        self.start();

        debug!("Inline terminal reinitialized");
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
