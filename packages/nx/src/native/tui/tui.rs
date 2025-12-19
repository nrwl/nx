use crate::native::tui::lifecycle::TuiMode;
use crate::native::tui::theme::THEME;
use color_eyre::eyre::Result;
use crossterm::{
    cursor,
    event::{Event as CrosstermEvent, KeyEvent, KeyEventKind},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen},
};
use futures::{FutureExt, StreamExt};
use ratatui::backend::CrosstermBackend;
use std::{
    io::Write,
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
    /// Terminal configured for inline mode (viewport)
    pub inline_terminal: ratatui::Terminal<Backend>,
    pub task: JoinHandle<()>,
    pub cancellation_token: CancellationToken,
    pub event_rx: UnboundedReceiver<Event>,
    pub event_tx: UnboundedSender<Event>,
    pub frame_rate: f64,
    pub tick_rate: f64,
    pub current_mode: TuiMode,
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

        // Create inline terminal with its own backend and viewport
        let inline_height = crossterm::terminal::size()
            .map(|(_cols, rows)| rows)
            .unwrap_or(24);
        let inline_terminal = ratatui::Terminal::with_options(
            CrosstermBackend::new(std::io::stderr()),
            ratatui::TerminalOptions {
                viewport: ratatui::Viewport::Inline(inline_height),
            },
        )?;

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

    /// Returns a reference to the currently active terminal based on mode
    pub fn terminal(&self) -> &ratatui::Terminal<Backend> {
        match self.current_mode {
            TuiMode::FullScreen => &self.fullscreen_terminal,
            TuiMode::Inline => &self.inline_terminal,
        }
    }

    /// Returns a mutable reference to the currently active terminal based on mode
    pub fn terminal_mut(&mut self) -> &mut ratatui::Terminal<Backend> {
        match self.current_mode {
            TuiMode::FullScreen => &mut self.fullscreen_terminal,
            TuiMode::Inline => &mut self.inline_terminal,
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

                tokio::select! {
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

    pub fn stop(&self) -> Result<()> {
        self.cancel();
        let mut counter = 0;
        while !self.task.is_finished() {
            std::thread::sleep(Duration::from_millis(1));
            counter += 1;
            if counter > 50 {
                self.task.abort();
            }
            if counter > 100 {
                // NOTE: This seems to happen frequently, but no ill effects have been observed yet.
                // TODO: Investigate further.
                debug!("Failed to abort TUI event loop task after 100ms, moving on anyway");
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

    pub fn exit(&mut self) -> Result<()> {
        self.stop()?;
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

        // Switch the mode - NO terminal recreation needed!
        // Both terminals were created upfront, we just delegate to the right one via Deref
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
        self.exit().unwrap();
    }
}
