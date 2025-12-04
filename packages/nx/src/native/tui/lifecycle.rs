use napi::JsObject;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use parking_lot::{Mutex, MutexGuard};
use std::sync::Arc;
use tracing::debug;

use crate::native::logger::enable_logger;
use crate::native::tasks::types::{Task, TaskGraph, TaskResult};
use crate::native::{
    ide::nx_console::messaging::NxConsoleMessageConnection,
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
};

use super::action::Action;
use super::app::App;
use super::components::tasks_list::TaskStatus;
use super::config::{AutoExit, TuiCliArgs as RustTuiCliArgs, TuiConfig as RustTuiConfig};
use super::inline_app::InlineApp;
use super::tui;
use super::tui::Tui;
use super::tui_app::TuiApp;
use super::tui_state::TuiState;

#[napi(object)]
#[derive(Clone)]
pub struct TuiCliArgs {
    #[napi(ts_type = "string[] | undefined")]
    pub targets: Option<Vec<String>>,

    #[napi(ts_type = "boolean | number | undefined")]
    pub tui_auto_exit: Option<Either<bool, u32>>,
}

impl From<TuiCliArgs> for RustTuiCliArgs {
    fn from(js: TuiCliArgs) -> Self {
        let js_auto_exit = js.tui_auto_exit.map(|value| match value {
            Either::A(bool_value) => AutoExit::Boolean(bool_value),
            Either::B(int_value) => AutoExit::Integer(int_value),
        });
        Self {
            targets: js.targets.unwrap_or_default(),
            tui_auto_exit: js_auto_exit,
        }
    }
}

#[napi(object)]
pub struct TuiConfig {
    #[napi(ts_type = "boolean | number | undefined")]
    pub auto_exit: Option<Either<bool, u32>>,
}

impl From<(TuiConfig, &RustTuiCliArgs)> for RustTuiConfig {
    fn from((js_tui_config, rust_tui_cli_args): (TuiConfig, &RustTuiCliArgs)) -> Self {
        let js_auto_exit = js_tui_config.auto_exit.map(|value| match value {
            Either::A(bool_value) => AutoExit::Boolean(bool_value),
            Either::B(int_value) => AutoExit::Integer(int_value),
        });
        // Pass the converted JSON config value(s) and cli_args to instantiate the config with
        RustTuiConfig::new(js_auto_exit, rust_tui_cli_args)
    }
}

#[napi]
pub enum RunMode {
    RunOne,
    RunMany,
}

#[napi]
#[derive(Debug, PartialEq, Eq)]
pub enum TuiMode {
    FullScreen,
    Inline,
}

/// Enum wrapper for either full-screen or inline TUI app
///
/// This allows AppLifeCycle to hold either App or InlineApp in the same field,
/// while still being able to call app-specific methods and work with NAPI bindings.
///
/// We use an enum instead of trait object (Arc<Mutex<dyn TuiApp>>) because:
/// - NAPI methods can't be called through trait objects
/// - Easier to downcast for TypeScript bindings
/// - Clear which type we have at compile time
pub enum TuiAppInstance {
    FullScreen(Arc<Mutex<App>>),
    Inline(Arc<Mutex<InlineApp>>),
}

/// A guard type that holds a MutexGuard for either App or InlineApp
/// and provides transparent access to the TuiApp trait methods.
///
/// This eliminates the need for closures at call sites - you can
/// directly call trait methods on the guard:
///
/// # Example
/// ```
/// app.lock().start_command(None);
/// ```
pub enum TuiAppGuard<'a> {
    FullScreen(MutexGuard<'a, App>),
    Inline(MutexGuard<'a, InlineApp>),
}

impl<'a> std::ops::Deref for TuiAppGuard<'a> {
    type Target = dyn TuiApp + 'a;

    fn deref(&self) -> &Self::Target {
        match self {
            TuiAppGuard::FullScreen(guard) => &**guard,
            TuiAppGuard::Inline(guard) => &**guard,
        }
    }
}

impl<'a> std::ops::DerefMut for TuiAppGuard<'a> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        match self {
            TuiAppGuard::FullScreen(guard) => &mut **guard,
            TuiAppGuard::Inline(guard) => &mut **guard,
        }
    }
}

impl TuiAppInstance {
    /// Lock and get a guard that derefs to `&mut dyn TuiApp`
    ///
    /// This allows direct method calls on the trait without closures:
    /// ```
    /// app.lock().start_command(None);
    /// ```
    fn lock(&self) -> TuiAppGuard<'_> {
        match self {
            TuiAppInstance::FullScreen(app) => TuiAppGuard::FullScreen(app.lock()),
            TuiAppInstance::Inline(app) => TuiAppGuard::Inline(app.lock()),
        }
    }
}

impl Clone for TuiAppInstance {
    fn clone(&self) -> Self {
        match self {
            TuiAppInstance::FullScreen(app) => TuiAppInstance::FullScreen(app.clone()),
            TuiAppInstance::Inline(app) => TuiAppInstance::Inline(app.clone()),
        }
    }
}

/// Result of a successful mode switch operation
struct ModeSwitchResult {
    new_app: TuiAppInstance,
    new_mode: TuiMode,
}

/// Switches the TUI between FullScreen and Inline modes.
///
/// This function handles the complete mode transition:
/// 1. Extracts shared state from the current app
/// 2. Switches the terminal viewport
/// 3. Creates a new app instance for the target mode
/// 4. Initializes the new app with action handlers
/// 5. Forces an immediate render
///
/// Returns `Some(ModeSwitchResult)` on success, `None` on failure.
/// On failure, the caller should break out of the event loop.
fn switch_mode(
    current_app: &TuiAppInstance,
    tui: &mut Tui,
    target_mode: TuiMode,
    action_tx: &tokio::sync::mpsc::UnboundedSender<Action>,
) -> Option<ModeSwitchResult> {
    debug!("🔄 Switching to {:?} mode", target_mode);

    // Get shared state and selected task from current app
    let (shared_state, selected_task) = {
        let guard = current_app.lock();
        (guard.get_shared_state(), guard.get_selected_task_name())
    };

    // Switch terminal viewport
    if let Err(e) = tui.switch_mode(target_mode) {
        debug!("❌ Failed to switch terminal mode: {}", e);
        current_app
            .lock()
            .get_shared_state()
            .lock()
            .quit_immediately();
        return None;
    }

    // Create new app instance with same state
    let new_app = match target_mode {
        TuiMode::FullScreen => {
            let app_instance = App::with_state(shared_state, target_mode)
                .expect("Failed to create full-screen app");
            TuiAppInstance::FullScreen(Arc::new(Mutex::new(app_instance)))
        }
        TuiMode::Inline => {
            debug!(
                "Creating inline app with selected task: {:?}",
                selected_task
            );
            let app_instance = InlineApp::with_state(shared_state, selected_task)
                .expect("Failed to create inline app");
            TuiAppInstance::Inline(Arc::new(Mutex::new(app_instance)))
        }
    };

    // Initialize new app
    {
        let mut guard = new_app.lock();
        guard.register_action_handler(action_tx.clone()).ok();
        guard
            .init(tui.size().unwrap_or(ratatui::layout::Size::new(80, 24)))
            .ok();
    }

    debug!("✅ Switched to {:?} mode", target_mode);

    Some(ModeSwitchResult {
        new_app,
        new_mode: target_mode,
    })
}

#[napi]
#[derive(Clone)]
pub struct AppLifeCycle {
    app: TuiAppInstance,
    workspace_root: Arc<String>,
    tui_mode: TuiMode,
}

#[napi]
impl AppLifeCycle {
    #[napi(constructor)]
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: Vec<String>,
        run_mode: RunMode,
        pinned_tasks: Vec<String>,
        tui_cli_args: TuiCliArgs,
        tui_config: TuiConfig,
        title_text: String,
        workspace_root: String,
        task_graph: TaskGraph,
        tui_mode: TuiMode,
    ) -> Self {
        // Get the target names from nx_args.targets
        let rust_tui_cli_args = tui_cli_args.into();

        // Convert JSON TUI configuration to our Rust TuiConfig
        let rust_tui_config = RustTuiConfig::from((tui_config, &rust_tui_cli_args));

        let initiating_tasks = initiating_tasks.into_iter().collect();
        let tasks = tasks.into_iter().collect();

        // Create shared state first - this is the same regardless of mode
        let shared_state = Arc::new(Mutex::new(TuiState::new(
            tasks,
            initiating_tasks,
            run_mode,
            pinned_tasks,
            rust_tui_config,
            title_text,
            task_graph,
            std::collections::HashMap::new(), // estimated_task_timings - will be set later
        )));

        debug!("Creating AppLifeCycle in {:?} mode", tui_mode);

        // Create the appropriate app based on mode, passing the shared state
        let app = match &tui_mode {
            TuiMode::FullScreen => {
                let app = App::with_state(shared_state, tui_mode).unwrap();
                TuiAppInstance::FullScreen(Arc::new(Mutex::new(app)))
            }
            TuiMode::Inline => {
                // For initial inline app creation, no task is selected yet
                let app = InlineApp::with_state(shared_state, None).unwrap();
                TuiAppInstance::Inline(Arc::new(Mutex::new(app)))
            }
        };

        Self {
            app,
            workspace_root: Arc::new(workspace_root),
            tui_mode,
        }
    }

    #[napi]
    pub fn start_command(&mut self, thread_count: Option<u32>) -> napi::Result<()> {
        self.app.lock().start_command(thread_count);
        Ok(())
    }

    #[napi]
    pub fn schedule_task(&mut self, _task: Task) -> napi::Result<()> {
        // Always intentional noop
        Ok(())
    }

    #[napi]
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _metadata: JsObject) -> napi::Result<()> {
        self.app.lock().start_tasks(tasks);
        Ok(())
    }

    #[napi]
    pub fn print_task_terminal_output(
        &mut self,
        task: Task,
        _status: String,
        output: String,
    ) -> napi::Result<()> {
        debug!("Received task terminal output for {}", task.id);
        self.app.lock().print_task_terminal_output(task.id, output);
        Ok(())
    }

    #[napi]
    pub fn end_tasks(
        &mut self,
        task_results: Vec<TaskResult>,
        _metadata: JsObject,
    ) -> napi::Result<()> {
        self.app.lock().end_tasks(task_results);
        Ok(())
    }

    #[napi]
    pub fn end_command(&self) -> napi::Result<()> {
        self.app.lock().end_command();
        Ok(())
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__init")]
    pub fn __init(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        debug!("🚀 AppLifeCycle::__init called");

        enable_logger();
        debug!("🚀 Initializing Terminal UI - Mode: {:?}", self.tui_mode);

        let mut app = self.app.clone();
        let workspace_root = self.workspace_root.clone();

        // Create Tui with appropriate viewport based on mode
        let mut tui = match self.tui_mode {
            TuiMode::FullScreen => {
                Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?
            }
            TuiMode::Inline => {
                let inline_height = crossterm::terminal::size()
                    .map(|(_cols, rows)| rows)
                    .unwrap_or(24);

                Tui::new_with_viewport(ratatui::Viewport::Inline(inline_height))
                    .map_err(|e| napi::Error::from_reason(e.to_string()))?
            }
        };

        // Enter terminal with appropriate mode
        tui.enter(self.tui_mode)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Set panic hook (identical for both modes)
        std::panic::set_hook(Box::new(move |panic_info| {
            // Only try to restore terminal if it's still in raw mode
            if let Ok(mut t) = Tui::new() {
                if let Err(r) = t.exit() {
                    debug!("Unable to exit Terminal: {:?}", r);
                }
            }
            better_panic::Settings::auto()
                .most_recent_first(false)
                .lineno_suffix(true)
                .verbosity(better_panic::Verbosity::Full)
                .create_panic_handler()(panic_info);
        }));

        debug!("Initialized Terminal UI");

        // Set rates (identical for both modes)
        tui.tick_rate(10.0);
        tui.frame_rate(60.0);

        // Initialize action channel (identical for both modes)
        let (action_tx, mut action_rx) = tokio::sync::mpsc::unbounded_channel();
        debug!("✅ Initialized Action Channel");

        // Initialize app through TuiApp trait (works for both modes!)
        {
            let mut guard = app.lock();
            guard.set_done_callback(done_callback);
            guard.register_action_handler(action_tx.clone()).ok();
            guard
                .init(tui.size().unwrap_or(ratatui::layout::Size::new(80, 24)))
                .ok();
        }

        debug!("✅ Initialized TUI App");

        let mut tui_mode = self.tui_mode.clone();

        // Spawn unified async task (identical for both modes!)
        napi::tokio::spawn(async move {
            // Set up console messenger (identical for both modes)
            {
                let connection = NxConsoleMessageConnection::new(&workspace_root).await;
                app.lock().set_console_messenger(connection);
            }

            // UNIFIED EVENT LOOP - works for both modes!
            loop {
                // Handle events through TuiApp trait
                if let Some(event) = tui.next().await {
                    // Check for mode switch hotkey FIRST (before app handles it)
                    if let tui::Event::Key(key) = &event {
                        use crossterm::event::KeyCode;

                        // Handle ESC key in inline mode - switch back to full-screen instead of quitting
                        if tui_mode == TuiMode::Inline && key.code == KeyCode::Esc {
                            match switch_mode(&app, &mut tui, TuiMode::FullScreen, &action_tx) {
                                Some(result) => {
                                    app = result.new_app;
                                    tui_mode = result.new_mode;
                                    app.lock()
                                        .handle_action(&mut tui, Action::Render, &action_tx);
                                    continue;
                                }
                                None => break,
                            }
                        }

                        if key.code == KeyCode::F(11) {
                            // User pressed F11 - toggle between modes
                            let target_mode = match tui_mode {
                                TuiMode::FullScreen => TuiMode::Inline,
                                TuiMode::Inline => TuiMode::FullScreen,
                            };

                            match switch_mode(&app, &mut tui, target_mode, &action_tx) {
                                Some(result) => {
                                    app = result.new_app;
                                    tui_mode = result.new_mode;
                                    // Force an immediate render (PTY resizing happens in init())
                                    // We call handle_action directly rather than sending Action::Render
                                    // because the event loop would block waiting for the next event before
                                    // processing actions, causing the UI to not appear until the user
                                    // presses a key
                                    app.lock()
                                        .handle_action(&mut tui, Action::Render, &action_tx);
                                    continue;
                                }
                                None => break,
                            }
                        }
                    }

                    // Handle event (return value ignored - quit is purely time-based)
                    let _ = app.lock().handle_event(event, &action_tx);

                    // Check if we should quit (time-based, like master branch)
                    if app.lock().should_quit() {
                        debug!("⏱️  should_quit() returned true - breaking event loop");
                        break;
                    }
                }

                // Process actions through TuiApp trait
                while let Ok(action) = action_rx.try_recv() {
                    app.lock().handle_action(&mut tui, action, &action_tx);
                }
            }

            // Cleanup and exit
            debug!("🏁 Event loop exited - cleaning up");
            // Exit the TUI before calling done callback (like master branch does)
            // The idempotent check in exit() will prevent double-exit when Drop runs
            tui.exit().ok();
            debug!("🏁 TUI exited, calling done callback");
            app.lock().call_done_callback();
            debug!("🏁 Done callback called");
        });

        Ok(())
    }

    #[napi]
    pub fn register_running_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        self.app
            .lock()
            .register_running_interactive_task(task_id, parser_and_writer);
    }

    #[napi]
    pub fn register_running_task_with_empty_parser(&mut self, task_id: String) {
        self.app
            .lock()
            .register_running_non_interactive_task(task_id);
    }

    #[napi]
    pub fn append_task_output(&mut self, task_id: String, output: String, is_pty_output: bool) {
        // If its from a pty, we already have it in the parser, so we don't need to append it again
        if !is_pty_output {
            self.app.lock().append_task_output(task_id, output);
        }
    }

    #[napi]
    pub fn set_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.app.lock().update_task_status(task_id, status);
    }

    #[napi]
    pub fn register_forced_shutdown_callback(
        &self,
        forced_shutdown_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        self.app
            .lock()
            .set_forced_shutdown_callback(forced_shutdown_callback);
        Ok(())
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__setCloudMessage")]
    pub async fn __set_cloud_message(&self, message: String) -> napi::Result<()> {
        self.app.lock().set_cloud_message(Some(message));
        Ok(())
    }

    #[napi]
    pub fn set_estimated_task_timings(
        &mut self,
        timings: std::collections::HashMap<String, i64>,
    ) -> napi::Result<()> {
        self.app.lock().set_estimated_task_timings(timings);
        Ok(())
    }
}

#[napi]
pub fn restore_terminal() -> napi::Result<()> {
    // Clear terminal progress indicator
    App::clear_terminal_progress();

    // Restore the terminal to a clean state
    if let Ok(mut t) = Tui::new() {
        if let Err(r) = t.exit() {
            debug!("Unable to exit Terminal: {:?}", r);
        }
    }
    Ok(())
}
