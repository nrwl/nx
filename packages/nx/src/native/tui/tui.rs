use crate::native::tui::lifecycle::TuiMode;
use crate::native::tui::theme::THEME;
use color_eyre::eyre::Result;
use crossterm::{
    cursor,
    event::{Event as CrosstermEvent, KeyEvent, KeyEventKind, MouseEvent},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen},
};
use futures::{FutureExt, StreamExt};
use ratatui::backend::CrosstermBackend as Backend;
use std::{
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
    pub terminal: ratatui::Terminal<Backend<std::io::Stderr>>,
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
        Self::new_with_options(None)
    }

    pub fn new_with_viewport(viewport: ratatui::Viewport) -> Result<Self> {
        Self::new_with_options(Some(ratatui::TerminalOptions { viewport }))
    }

    fn new_with_options(options: Option<ratatui::TerminalOptions>) -> Result<Self> {
        let tick_rate = 10.0;
        let frame_rate = 60.0;
        let backend = Backend::new(std::io::stderr());
        let terminal = if let Some(opts) = options {
            ratatui::Terminal::with_options(backend, opts)?
        } else {
            ratatui::Terminal::new(backend)?
        };

        let (event_tx, event_rx) = mpsc::unbounded_channel();
        let cancellation_token = CancellationToken::new();
        let task = tokio::spawn(async {});
        Ok(Self {
            terminal,
            task,
            cancellation_token,
            event_rx,
            event_tx,
            frame_rate,
            tick_rate,
            current_mode: TuiMode::FullScreen, // Default to full-screen
        })
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
                let crossterm_event = reader.next().fuse();
                tokio::select! {
                  _ = _cancellation_token.cancelled() => {
                    debug!("Got a cancellation token");
                    break;
                  }
                  _ = tick_interval.tick() => {
                      trace!("⏱️  Sending Tick event");
                      _event_tx.send(Event::Tick).expect("cannot send event");
                  },
                  _ = render_interval.tick() => {
                      trace!("🎨 Sending Render event");
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
                          CrosstermEvent::Mouse(mouse) => {
                            _event_tx.send(Event::Mouse(mouse)).unwrap();
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
                // This log is hit most of the time, but this condition does not seem to be problematic in practice
                // TODO: Investigate this moore deeply
                // log::error!("Failed to abort task in 100 milliseconds for unknown reason");
                break;
            }
        }
        Ok(())
    }

    pub fn enter(&mut self) -> Result<()> {
        self.enter_with_mode(TuiMode::FullScreen)
    }

    pub fn enter_with_mode(&mut self, mode: TuiMode) -> Result<()> {
        // Ensure the theme is set before entering raw mode because it won't work properly once we're in raw mode
        let _ = THEME.is_dark_mode;
        debug!("Enabling Raw Mode for {:?} mode", mode);
        crossterm::terminal::enable_raw_mode()?;

        match mode {
            TuiMode::FullScreen => {
                execute!(std::io::stderr(), EnterAlternateScreen, cursor::Hide)?;
            }
            TuiMode::Inline => {
                // For inline mode, just hide cursor - no alternate screen
                execute!(std::io::stderr(), cursor::Hide)?;
            }
        }

        self.start();
        Ok(())
    }

    pub fn exit(&mut self) -> Result<()> {
        self.stop()?;
        if crossterm::terminal::is_raw_mode_enabled()? {
            self.flush()?;

            // Only leave alternate screen if we're in full-screen mode
            match self.current_mode {
                TuiMode::FullScreen => {
                    execute!(std::io::stderr(), LeaveAlternateScreen, cursor::Show)?;
                }
                TuiMode::Inline => {
                    // For inline mode, just show cursor (no alternate screen to leave)
                    execute!(std::io::stderr(), cursor::Show)?;
                }
            }

            crossterm::terminal::disable_raw_mode()?;
        }
        Ok(())
    }

    /// Switch between full-screen and inline viewport modes
    ///
    /// This method properly recreates the terminal with the correct viewport
    /// for the new mode. It handles:
    /// 1. Stopping the event loop
    /// 2. Exiting raw mode and cleaning up the current terminal
    /// 3. Creating a new terminal with the appropriate viewport
    /// 4. Re-entering raw mode with the new mode
    ///
    /// # Arguments
    /// * `new_mode` - The TUI mode to switch to
    ///
    /// # Returns
    /// * `Ok(())` if the switch was successful
    /// * `Err(...)` if there was an error during the terminal state transition
    pub fn switch_mode(&mut self, new_mode: TuiMode) -> Result<()> {
        debug!("🔄 Switching terminal mode to {:?}", new_mode);

        // Step 1: Stop the event loop
        self.stop()?;

        // Step 2: Flush current terminal state
        self.flush()?;

        // Step 3: Handle screen mode transitions while staying in raw mode
        // Raw mode must stay enabled for cursor position queries to work
        match new_mode {
            TuiMode::FullScreen => {
                // Switching TO full-screen: enter alternate screen
                execute!(std::io::stderr(), EnterAlternateScreen)?;
            }
            TuiMode::Inline => {
                // Switching TO inline: leave alternate screen
                execute!(std::io::stderr(), LeaveAlternateScreen)?;
            }
        }

        // Step 4: Create new terminal with appropriate viewport
        // Still in raw mode, so cursor queries work reliably
        let terminal = match new_mode {
            TuiMode::FullScreen => {
                debug!("📺 Creating full-screen terminal (no viewport)");
                let backend = Backend::new(std::io::stderr());
                ratatui::Terminal::new(backend)?
            }
            TuiMode::Inline => {
                debug!("📱 Creating inline terminal (inline viewport)");

                // Retry logic for cursor position query with exponential backoff
                // Terminal emulators need time to stabilize after leaving alternate screen
                let delays = [50, 100, 150]; // Try with 50ms, 100ms, 150ms delays
                let mut last_error = None;
                let mut terminal = None;

                for (attempt, delay_ms) in delays.iter().enumerate() {
                    if attempt > 0 {
                        debug!("⏳ Retry attempt {} after {}ms delay", attempt + 1, delay_ms);
                    }

                    // Wait for terminal to stabilize
                    std::thread::sleep(Duration::from_millis(*delay_ms));

                    // Try to create inline viewport
                    let backend = Backend::new(std::io::stderr());
                    let inline_height = crossterm::terminal::size()
                        .map(|(_cols, rows)| rows)
                        .unwrap_or(24);

                    let viewport = ratatui::Viewport::Inline(inline_height);
                    match ratatui::Terminal::with_options(backend, ratatui::TerminalOptions { viewport }) {
                        Ok(term) => {
                            if attempt > 0 {
                                debug!("✅ Successfully created inline viewport on attempt {}", attempt + 1);
                            }
                            terminal = Some(term);
                            break;
                        }
                        Err(e) => {
                            debug!("❌ Failed to create inline viewport on attempt {}: {}", attempt + 1, e);
                            last_error = Some(e);
                        }
                    }
                }

                // If all retries failed, return the last error
                terminal.ok_or_else(|| last_error.unwrap())?
            }
        };

        self.terminal = terminal;
        self.current_mode = new_mode; // Track current mode

        // Step 5: Restart event loop (still in raw mode)
        self.start();

        debug!("✅ Switched to {:?} mode", new_mode);
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
    type Target = ratatui::Terminal<Backend<std::io::Stderr>>;

    fn deref(&self) -> &Self::Target {
        &self.terminal
    }
}

impl DerefMut for Tui {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.terminal
    }
}

impl Drop for Tui {
    fn drop(&mut self) {
        self.exit().unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tui::lifecycle::TuiMode;

    #[test]
    fn test_tui_creation() {
        let result = Tui::new();
        assert!(result.is_ok(), "Tui should be created successfully");
    }

    #[test]
    fn test_tui_with_viewport() {
        let viewport = ratatui::Viewport::Inline(10);
        let result = Tui::new_with_viewport(viewport);
        assert!(
            result.is_ok(),
            "Tui with viewport should be created successfully"
        );
    }

    #[test]
    fn test_tick_rate_setting() {
        let mut tui = Tui::new().unwrap();
        let new_rate = 20.0;
        tui.tick_rate(new_rate);
        assert_eq!(
            tui.tick_rate, new_rate,
            "Tick rate should be updated to {}",
            new_rate
        );
    }

    #[test]
    fn test_frame_rate_setting() {
        let mut tui = Tui::new().unwrap();
        let new_rate = 120.0;
        tui.frame_rate(new_rate);
        assert_eq!(
            tui.frame_rate, new_rate,
            "Frame rate should be updated to {}",
            new_rate
        );
    }

    #[test]
    fn test_switch_mode_to_inline() {
        let mut tui = Tui::new().unwrap();
        let result = tui.switch_mode(TuiMode::Inline);
        assert!(
            result.is_ok(),
            "Switching to inline mode should succeed: {:?}",
            result
        );
    }

    #[test]
    fn test_switch_mode_to_fullscreen() {
        let mut tui = Tui::new().unwrap();
        let result = tui.switch_mode(TuiMode::FullScreen);
        assert!(
            result.is_ok(),
            "Switching to full-screen mode should succeed: {:?}",
            result
        );
    }

    #[test]
    fn test_switch_mode_multiple_times() {
        let mut tui = Tui::new().unwrap();

        // Switch to inline
        let result = tui.switch_mode(TuiMode::Inline);
        assert!(
            result.is_ok(),
            "First switch to inline should succeed: {:?}",
            result
        );

        // Switch to full-screen
        let result = tui.switch_mode(TuiMode::FullScreen);
        assert!(
            result.is_ok(),
            "Switch to full-screen should succeed: {:?}",
            result
        );

        // Switch back to inline
        let result = tui.switch_mode(TuiMode::Inline);
        assert!(
            result.is_ok(),
            "Second switch to inline should succeed: {:?}",
            result
        );
    }
}
