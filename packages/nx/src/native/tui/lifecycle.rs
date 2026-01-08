use napi::JsObject;
use napi::bindgen_prelude::*;
use parking_lot::{Mutex, MutexGuard};
use std::io::Write;
use std::sync::Arc;
use tracing::debug;

#[cfg(not(test))]
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};

#[cfg(not(test))]
use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
#[cfg(not(test))]
use crate::native::logger::enable_logger;
use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};
use crate::native::tasks::types::{Task, TaskGraph, TaskResult};

#[cfg(not(test))]
use super::action::Action;
use super::app::App;
use super::components::tasks_list::TaskStatus;
use super::config::{AutoExit, TuiCliArgs as RustTuiCliArgs, TuiConfig as RustTuiConfig};
use super::inline_app::InlineApp;
#[cfg(not(test))]
use super::tui::{Event, Tui};
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
    pub suppress_hints: Option<bool>,
}

impl From<(TuiConfig, &RustTuiCliArgs)> for RustTuiConfig {
    fn from((js_tui_config, rust_tui_cli_args): (TuiConfig, &RustTuiCliArgs)) -> Self {
        let js_auto_exit = js_tui_config.auto_exit.map(|value| match value {
            Either::A(bool_value) => AutoExit::Boolean(bool_value),
            Either::B(int_value) => AutoExit::Integer(int_value),
        });
        // Pass the converted JSON config value(s) and cli_args to instantiate the config with
        RustTuiConfig::new(
            js_auto_exit,
            js_tui_config.suppress_hints,
            rust_tui_cli_args,
        )
    }
}

#[napi]
pub enum RunMode {
    RunOne,
    RunMany,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
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

/// Switches the TUI between FullScreen and Inline modes.
///
/// This function handles the complete mode transition:
/// 1. Extracts shared state from the current app
/// 2. Switches the terminal viewport
/// 3. Creates a new app instance for the target mode
/// 4. Initializes the new app with action handlers
/// 5. Updates the shared app reference so NAPI methods see the new app
///
/// Returns `Some(new_mode)` on success, `None` on failure.
/// On failure, the caller should break out of the event loop.
#[cfg(not(test))]
fn switch_mode(
    shared_app: &SharedAppInstance,
    tui: &mut Tui,
    target_mode: TuiMode,
    action_tx: &tokio::sync::mpsc::UnboundedSender<Action>,
) -> Option<TuiMode> {
    debug!("Switching to {:?} mode", target_mode);

    // Inline mode requires cursor position queries which hang when stdin is not a TTY.
    // This happens in git hooks where stderr is a TTY but stdin is redirected.
    // In this case, show a hint to the user and stay in fullscreen mode instead of hanging.
    // See: https://github.com/crossterm-rs/crossterm/issues/692
    if target_mode == TuiMode::Inline {
        let inline_tui_unsupported = tui.inline_tui_unsupported_reason();
        if let Some(reason) = inline_tui_unsupported {
            debug!(
                "Cannot switch to inline mode: {}. \
                 Staying in fullscreen mode to avoid hanging on cursor position query.",
                reason
            );
            // Show hint to inform user why inline mode is unavailable
            let _ = action_tx.send(Action::ShowHint(format!(
                "Inline mode is not available in this environment: {}",
                reason
            )));
            return Some(tui.current_mode);
        }
    }

    // Save UI state before switching (for full-screen mode persistence)
    // and get the task to display in inline mode
    let (shared_state, focused_task) = {
        let app_instance = shared_app.lock();
        let guard = app_instance.lock();
        // Save the current UI state so it can be restored later
        guard.save_ui_state_for_mode_switch();
        // For inline mode, prefer the focused pane task over just the selected task
        let task = guard
            .get_focused_pane_task()
            .or_else(|| guard.get_selected_task_name());
        (guard.get_shared_state(), task)
    };

    // Switch terminal viewport
    if let Err(e) = tui.switch_mode(target_mode) {
        debug!("Failed to switch terminal mode: {}", e);
        shared_state.lock().quit_immediately();
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
            debug!("Creating inline app with focused task: {:?}", focused_task);
            let app_instance = InlineApp::with_state(shared_state, focused_task)
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

    // Update the shared reference so NAPI methods see the new app
    *shared_app.lock() = new_app;

    debug!("Switched to {:?} mode", target_mode);

    Some(target_mode)
}

/// Shared reference to the current TUI app instance
///
/// This is wrapped in Arc<Mutex<>> so that:
/// 1. The async event loop can update it during mode switches
/// 2. NAPI methods always see the current app (not a stale clone)
type SharedAppInstance = Arc<Mutex<TuiAppInstance>>;

/// Helper to execute a closure with access to the TUI app from a SharedAppInstance
///
/// This handles the double-lock pattern (outer Arc<Mutex> + inner app mutex).
/// Used in the async event loop where we can't use AppLifeCycle::with_app.
fn with_shared_app<R>(shared: &SharedAppInstance, f: impl FnOnce(&mut dyn TuiApp) -> R) -> R {
    let app_instance = shared.lock();
    let mut guard = app_instance.lock();
    f(&mut *guard)
}

#[napi]
#[derive(Clone)]
pub struct AppLifeCycle {
    app: SharedAppInstance,
    workspace_root: Arc<String>,
}

impl AppLifeCycle {
    /// Execute a closure with access to the current TUI app
    ///
    /// This handles the double-lock pattern cleanly:
    /// 1. Locks the outer Arc<Mutex<TuiAppInstance>>
    /// 2. Locks the inner app (App or InlineApp)
    /// 3. Passes &mut dyn TuiApp to the closure
    fn with_app<R>(&self, f: impl FnOnce(&mut dyn TuiApp) -> R) -> R {
        let app_instance = self.app.lock();
        let mut guard = app_instance.lock();
        f(&mut *guard)
    }
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
            None,
        )));

        // Default to FullScreen mode for the constructor
        let tui_mode = TuiMode::FullScreen;

        debug!("Creating AppLifeCycle in {:?} mode", tui_mode);

        // Create the appropriate app based on mode, passing the shared state
        // Wrap in Arc<Mutex<>> so mode switches in the event loop are visible to NAPI methods
        let app = {
            let app = App::with_state(shared_state, tui_mode).unwrap();
            let app_instance = TuiAppInstance::FullScreen(Arc::new(Mutex::new(app)));
            Arc::new(Mutex::new(app_instance))
        };

        Self {
            app,
            workspace_root: Arc::new(workspace_root),
        }
    }

    #[napi]
    pub fn start_command(&mut self, thread_count: Option<u32>) -> napi::Result<()> {
        self.with_app(|app| app.start_command(thread_count));
        Ok(())
    }

    #[napi]
    pub fn schedule_task(&mut self, _task: Task) -> napi::Result<()> {
        // Always intentional noop
        Ok(())
    }

    #[napi]
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _metadata: JsObject) -> napi::Result<()> {
        self.with_app(|app| app.start_tasks(tasks));
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
        self.with_app(|app| app.print_task_terminal_output(task.id, output));
        Ok(())
    }

    #[napi]
    pub fn end_tasks(
        &mut self,
        task_results: Vec<TaskResult>,
        _metadata: JsObject,
    ) -> napi::Result<()> {
        self.with_app(|app| app.end_tasks(task_results));
        Ok(())
    }

    #[napi]
    pub fn end_command(&self) -> napi::Result<()> {
        self.with_app(|app| app.end_command());
        Ok(())
    }

    // Rust-only lifecycle method
    // This method is excluded from test builds because it uses ThreadsafeFunction
    // which requires Node.js runtime symbols.
    #[cfg(not(test))]
    #[napi(js_name = "__init")]
    pub fn __init(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        debug!("AppLifeCycle::__init called");

        enable_logger();

        // Always start in FullScreen mode
        let initial_mode = TuiMode::FullScreen;
        debug!("Initializing Terminal UI - Mode: {:?}", initial_mode);

        let app = self.app.clone();
        let workspace_root = self.workspace_root.clone();

        // Create Tui with FullScreen viewport
        let mut tui = Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Enter terminal in FullScreen mode
        tui.enter(initial_mode)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Set panic hook (identical for both modes)
        std::panic::set_hook(Box::new(move |panic_info| {
            // Only try to restore terminal if it's still in raw mode
            // NOTE: We use exit_sync() here because panic handlers are sync context.
            // The 100ms delay is acceptable during a panic - we just need to restore the terminal.
            if let Ok(mut t) = Tui::new() {
                if let Err(r) = t.exit_sync() {
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
        debug!("Initialized action channel");

        // Initialize app through TuiApp trait (works for both modes!)
        {
            let app_instance = app.lock();
            let mut guard = app_instance.lock();
            guard.set_done_callback(done_callback);
            guard.register_action_handler(action_tx.clone()).ok();
            guard
                .init(tui.size().unwrap_or(ratatui::layout::Size::new(80, 24)))
                .ok();
        }

        debug!("Initialized TUI App");

        let mut tui_mode = initial_mode;

        // Spawn unified async task (identical for both modes!)
        napi::tokio::spawn(async move {
            // Set up console messenger (identical for both modes)
            {
                let connection = NxConsoleMessageConnection::new(&workspace_root).await;
                with_shared_app(&app, |a| a.set_console_messenger(connection));
            }

            // UNIFIED EVENT LOOP - works for both modes!
            loop {
                // Handle events through TuiApp trait
                if let Some(event) = tui.next().await {
                    // some events have global handling
                    match event {
                        Event::Resize(_w, _h) => {
                            // Reinitialize the inline terminal with new dimensions.
                            // The inline viewport's height is fixed at creation time, so we
                            // need to recreate it when the terminal is resized.
                            // This properly stops/starts the event stream thanks to our async fix.
                            if let Err(e) = tui.reinitialize_inline_terminal().await {
                                debug!("Failed to reinitialize inline terminal: {:?}", e);
                            }
                        }
                        _ => {
                            // no global handler
                        }
                    }
                    // Pass event to app - mode switching is handled via Action::SwitchMode
                    // which is dispatched by the apps and processed in the action loop below
                    let _ = with_shared_app(&app, |a| a.handle_event(event, &action_tx));

                    // Check if we should quit (time-based, like master branch)
                    if with_shared_app(&app, |a| a.should_quit()) {
                        debug!("should_quit() returned true - breaking event loop");
                        break;
                    }
                }

                // Process actions through TuiApp trait
                while let Ok(action) = action_rx.try_recv() {
                    // Handle SwitchMode action at the lifecycle level (requires recreating app)
                    if let Action::SwitchMode(target_mode) = action {
                        // Only switch if target mode differs from current
                        if target_mode != tui_mode {
                            // switch_mode updates the shared app reference in place
                            match switch_mode(&app, &mut tui, target_mode, &action_tx) {
                                Some(new_mode) => {
                                    tui_mode = new_mode;
                                    // Force an immediate render
                                    with_shared_app(&app, |a| {
                                        a.handle_action(&mut tui, Action::Render, &action_tx)
                                    });
                                }
                                None => break, // switch_mode failed, exit event loop
                            }
                        }
                    } else {
                        with_shared_app(&app, |a| a.handle_action(&mut tui, action, &action_tx));
                    }
                }
            }

            // Cleanup and exit
            debug!("Event loop exited - cleaning up");
            tui.exit().await.ok();
            debug!("TUI exited, calling done callback");
            with_shared_app(&app, |a| a.call_done_callback());
            debug!("Done callback called");
        });

        Ok(())
    }

    #[napi]
    pub fn register_running_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        self.with_app(|app| app.register_running_interactive_task(task_id, parser_and_writer));
    }

    #[napi]
    pub fn register_running_task_with_empty_parser(&mut self, task_id: String) {
        self.with_app(|app| app.register_running_non_interactive_task(task_id));
    }

    #[napi]
    pub fn append_task_output(&mut self, task_id: String, output: String, is_pty_output: bool) {
        // If its from a pty, we already have it in the parser, so we don't need to append it again
        if !is_pty_output {
            self.with_app(|app| app.append_task_output(task_id, output));
        }
    }

    #[napi]
    pub fn set_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.with_app(|app| app.update_task_status(task_id, status));
    }

    // This method is excluded from test builds because it uses ThreadsafeFunction
    // which requires Node.js runtime symbols.
    #[cfg(not(test))]
    #[napi]
    pub fn register_forced_shutdown_callback(
        &self,
        forced_shutdown_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        self.with_app(|app| app.set_forced_shutdown_callback(forced_shutdown_callback));
        Ok(())
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__setCloudMessage")]
    pub async fn __set_cloud_message(&self, message: String) -> napi::Result<()> {
        self.with_app(|app| app.set_cloud_message(Some(message)));
        Ok(())
    }

    #[napi]
    pub fn set_estimated_task_timings(
        &mut self,
        timings: std::collections::HashMap<String, i64>,
    ) -> napi::Result<()> {
        self.with_app(|app| app.set_estimated_task_timings(timings));
        Ok(())
    }
}

#[napi]
pub fn restore_terminal() -> napi::Result<()> {
    // Clear terminal progress indicator
    App::clear_terminal_progress();

    // Drain pending terminal responses (e.g., OSC color query responses)
    // to prevent escape sequences from leaking to the terminal on exit
    super::tui::drain_stdin();

    if crossterm::terminal::is_raw_mode_enabled()? {
        crossterm::execute!(
            std::io::stderr(),
            crossterm::terminal::LeaveAlternateScreen,
            crossterm::cursor::MoveTo(0, 0),
            crossterm::terminal::Clear(crossterm::terminal::ClearType::All),
            crossterm::cursor::Show
        )?;
        std::io::stderr().flush()?;
    }

    crossterm::execute!(std::io::stderr(), crossterm::cursor::Show)?;

    crossterm::terminal::disable_raw_mode()?;

    Ok(())
}
