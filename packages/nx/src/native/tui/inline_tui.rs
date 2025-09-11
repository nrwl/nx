use color_eyre::eyre::Result;
use crossterm::{
    cursor,
    event::{self, Event as CrosstermEvent, KeyCode, KeyEvent, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode},
};
use ratatui::{
    Frame, Terminal,
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Gauge, List, ListItem, Paragraph, Widget},
};
use std::{
    collections::HashMap,
    io::{self, Stderr, Write},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tracing::trace;

use super::components::tasks_list::TaskStatus;
use crate::native::{pseudo_terminal::pseudo_terminal::WriterArc, tasks::types::Task};

/// Inline TUI mode that displays UI below running commands using ratatui's inline viewport
pub struct InlineTui {
    terminal: Terminal<CrosstermBackend<Stderr>>,
    tasks: Vec<Task>,
    task_status: HashMap<String, TaskStatus>,
    current_task: Option<String>,
    should_quit: Arc<AtomicBool>,
    event_tx: UnboundedSender<InlineEvent>,
    event_rx: UnboundedReceiver<InlineEvent>,
    // Writer for sending input to the running command
    writer: Option<WriterArc>,
    // PTY instance for accessing screen content like terminal_pane.rs
    pty: Option<Arc<crate::native::tui::pty::PtyInstance>>,
    // Progress tracking
    completed_tasks: usize,
    total_tasks: usize,
    // Track the last rendered scrollback length to avoid re-rendering same content
    last_scrollback_length: usize,
}

#[derive(Debug, Clone)]
pub enum InlineEvent {
    TaskStarted(String),
    TaskCompleted(String, bool), // task_id, success
    TaskOutput(String, String),  // task_id, output_line (kept for compatibility but not used)
    KeyPress(KeyEvent),
    Tick,
    Quit,
}

impl InlineTui {
    pub fn new(tasks: Vec<Task>) -> Result<Self> {
        let total_tasks = tasks.len();
        let mut task_status = HashMap::new();

        for task in &tasks {
            task_status.insert(task.id.clone(), TaskStatus::NotStarted);
        }

        let (event_tx, event_rx) = mpsc::unbounded_channel();

        // Create terminal with inline viewport
        // Check if stderr is a TTY before creating the terminal
        use std::io::IsTerminal;
        let backend = CrosstermBackend::new(io::stderr());

        // Use a fallback if not in a TTY environment
        let terminal = if io::stderr().is_terminal() {
            Terminal::with_options(
                backend,
                ratatui::TerminalOptions {
                    viewport: ratatui::Viewport::Inline(8), // Reserve 8 lines for UI below commands
                },
            )?
        } else {
            // Fallback to regular terminal for non-TTY environments
            Terminal::new(backend)?
        };

        Ok(Self {
            terminal,
            tasks,
            task_status,
            current_task: None,
            should_quit: Arc::new(AtomicBool::new(false)),
            event_tx,
            event_rx,
            writer: None,
            pty: None,
            completed_tasks: 0,
            total_tasks,
            last_scrollback_length: 0,
        })
    }

    pub fn set_pty(&mut self, pty: Arc<crate::native::tui::pty::PtyInstance>) {
        trace!("Setting PTY instance for inline TUI");
        self.pty = Some(pty);
        trace!("PTY instance set successfully");
    }

    pub fn set_writer(&mut self, writer: WriterArc) {
        self.writer = Some(writer);
    }

    pub async fn run(&mut self) -> Result<()> {
        self.setup_terminal()?;

        let result = self.run_app().await;

        self.restore_terminal()?;

        result
    }

    fn setup_terminal(&mut self) -> Result<()> {
        enable_raw_mode()?;
        execute!(io::stderr(), cursor::Hide)?;
        Ok(())
    }

    fn restore_terminal(&mut self) -> Result<()> {
        disable_raw_mode()?;
        execute!(io::stderr(), cursor::Show)?;
        // Clear the inline viewport area
        self.terminal.clear()?;
        Ok(())
    }

    async fn run_app(&mut self) -> Result<()> {
        // Start event handler
        let event_tx = self.event_tx.clone();
        let should_quit = self.should_quit.clone();

        tokio::spawn(async move {
            let mut tick_interval = tokio::time::interval(Duration::from_millis(250));

            loop {
                if should_quit.load(Ordering::Relaxed) {
                    break;
                }

                tokio::select! {
                    _ = tick_interval.tick() => {
                        let _ = event_tx.send(InlineEvent::Tick);
                    }
                }
            }
        });

        // Start keyboard input handler
        let event_tx = self.event_tx.clone();
        let should_quit = self.should_quit.clone();

        std::thread::spawn(move || {
            while !should_quit.load(Ordering::Relaxed) {
                if event::poll(Duration::from_millis(100)).unwrap_or(false) {
                    if let Ok(CrosstermEvent::Key(key)) = event::read() {
                        let _ = event_tx.send(InlineEvent::KeyPress(key));
                    }
                }
            }
        });

        // Output monitoring is now handled via stdout_rx channel to avoid parser lock contention

        // Main event loop
        trace!("Starting inline TUI main event loop");
        while let Some(event) = self.event_rx.recv().await {
            match event {
                InlineEvent::Quit => break,
                InlineEvent::KeyPress(key) => {
                    if self.handle_key_event(key)? {
                        break;
                    }
                }
                InlineEvent::TaskStarted(task_id) => {
                    self.current_task = Some(task_id.clone());
                    self.task_status.insert(task_id, TaskStatus::InProgress);
                }
                InlineEvent::TaskCompleted(task_id, success) => {
                    let status = if success {
                        TaskStatus::Success
                    } else {
                        TaskStatus::Failure
                    };
                    self.task_status.insert(task_id.clone(), status);
                    self.completed_tasks += 1;

                    if &Some(task_id.clone()) == &self.current_task {
                        self.current_task = None;
                    }
                }
                InlineEvent::TaskOutput(_task_id, _output) => {
                    // TaskOutput events are received but we handle scrollback during Tick
                }
                InlineEvent::Tick => {
                    self.render_scrollback_content();
                    self.draw_ui()?;
                }
            }
        }

        Ok(())
    }

    fn handle_key_event(&mut self, key: KeyEvent) -> Result<bool> {
        match key.code {
            KeyCode::Char('q') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.should_quit.store(true, Ordering::Relaxed);
                return Ok(true);
            }
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                // Pass Ctrl+C to the running process if we have a writer
                if let Some(writer) = &self.writer {
                    let mut writer = writer.lock();
                    let _ = writer.write_all(&[3]); // ASCII ETX (Ctrl+C)
                }
            }
            _ => {}
        }
        Ok(false)
    }

    fn draw_ui(&mut self) -> Result<()> {
        let current_task = self.current_task.clone();
        let completed = self.completed_tasks;
        let total = self.total_tasks;
        let tasks = self.tasks.clone();
        let task_status = self.task_status.clone();

        self.terminal.draw(|frame| {
            let area = frame.area();

            // Create layout with three sections
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3), // Status bar
                    Constraint::Length(3), // Progress bar
                    Constraint::Min(2),    // Task list
                ])
                .split(area);

            // Draw status bar
            Self::draw_status_bar_static(frame, chunks[0], &current_task);

            // Draw progress bar
            Self::draw_progress_bar_static(frame, chunks[1], completed, total);

            // Draw task list
            Self::draw_task_list_static(frame, chunks[2], &tasks, &task_status);
        })?;

        Ok(())
    }

    fn draw_status_bar_static(frame: &mut Frame, area: Rect, current_task: &Option<String>) {
        let status_text = if let Some(task_id) = current_task {
            format!(" Running: {} ", task_id)
        } else {
            " Idle ".to_string()
        };

        let status = Paragraph::new(status_text)
            .style(Style::default().fg(Color::Cyan))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Status ")
                    .border_style(Style::default().fg(Color::Gray)),
            );

        frame.render_widget(status, area);
    }

    fn draw_progress_bar_static(
        frame: &mut Frame,
        area: Rect,
        completed_tasks: usize,
        total_tasks: usize,
    ) {
        let progress = if total_tasks > 0 {
            (completed_tasks as f64 / total_tasks as f64) * 100.0
        } else {
            0.0
        };

        let gauge = Gauge::default()
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Progress ")
                    .border_style(Style::default().fg(Color::Gray)),
            )
            .gauge_style(Style::default().fg(Color::Green))
            .percent(progress as u16)
            .label(format!("{}/{} tasks", completed_tasks, total_tasks));

        frame.render_widget(gauge, area);
    }

    fn draw_task_list_static(
        frame: &mut Frame,
        area: Rect,
        tasks: &[Task],
        task_status: &HashMap<String, TaskStatus>,
    ) {
        let items: Vec<ListItem> = tasks
            .iter()
            .map(|task| {
                let status = task_status.get(&task.id).unwrap_or(&TaskStatus::NotStarted);
                let (symbol, style) = match status {
                    TaskStatus::NotStarted => ("○", Style::default().fg(Color::Gray)),
                    TaskStatus::InProgress => ("◉", Style::default().fg(Color::Yellow)),
                    TaskStatus::Success => ("✓", Style::default().fg(Color::Green)),
                    TaskStatus::Failure => ("✗", Style::default().fg(Color::Red)),
                    _ => ("?", Style::default()),
                };

                let content = format!("{} {}", symbol, task.id);
                ListItem::new(content).style(style)
            })
            .collect();

        let list = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Tasks ")
                .border_style(Style::default().fg(Color::Gray)),
        );

        frame.render_widget(list, area);
    }

    pub fn get_event_sender(&self) -> UnboundedSender<InlineEvent> {
        self.event_tx.clone()
    }

    pub fn notify_task_started(&self, task_id: String) {
        let _ = self.event_tx.send(InlineEvent::TaskStarted(task_id));
    }

    pub fn notify_task_completed(&self, task_id: String, success: bool) {
        let _ = self
            .event_tx
            .send(InlineEvent::TaskCompleted(task_id, success));
    }

    pub fn notify_task_output(&self, task_id: String, output: String) {
        trace!("Task output for {}: {}", task_id, output);
        let _ = self.event_tx.send(InlineEvent::TaskOutput(task_id, output));
    }

    /// Render scrollback content using insert_before to display above the TUI
    /// Uses the same approach as terminal_pane.rs to access screen content
    /// Gracefully handles parser lock contention by skipping updates when parser is busy
    fn render_scrollback_content(&mut self) {
        if let Some(pty) = &self.pty {
            // Use the same graceful approach as terminal_pane.rs - get_screen() returns None if parser is locked
            trace!("Attempting to get screen for scrollback rendering");
            if let Some(screen) = pty.get_screen() {
                trace!("Successfully got screen for scrollback rendering");
                let all_contents = screen.all_contents();
                let content_lines: Vec<&str> = all_contents.lines().collect();

                // Only render new content lines since last render
                if content_lines.len() > self.last_scrollback_length {
                    let new_lines: Vec<String> = content_lines
                        .iter()
                        .skip(self.last_scrollback_length)
                        .map(|line| line.to_string())
                        .collect();

                    // Render all new lines at once using insert_before
                    if !new_lines.is_empty() {
                        trace!("Rendering {} new lines using insert_before", new_lines.len());
                        let _ = self.terminal.insert_before(new_lines.len() as u16, |buf| {
                            // Create lines for each new content line
                            let lines: Vec<Line> = new_lines
                                .iter()
                                .map(|line_content| Line::from(Span::raw(line_content.clone())))
                                .collect();

                            // Render as a paragraph
                            let paragraph = Paragraph::new(lines);
                            paragraph.render(buf.area, buf);
                        });
                    }

                    self.last_scrollback_length = content_lines.len();
                }
            } else {
                trace!("Could not get screen (parser is busy), skipping scrollback update");
            }
            // If get_screen() returns None, we gracefully skip this update - parser is busy
        }
    }
}
