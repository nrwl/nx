use napi::JsObject;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use parking_lot::Mutex;
use std::sync::Arc;
use tracing::{debug, trace};

use crate::native::logger::enable_logger;
use crate::native::tasks::types::{Task, TaskGraph, TaskResult};
use crate::native::{
    ide::nx_console::messaging::NxConsoleMessageConnection,
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
};

use super::app::App;
use super::components::tasks_list::TaskStatus;
use super::config::{AutoExit, TuiCliArgs as RustTuiCliArgs, TuiConfig as RustTuiConfig};
use super::tui::Tui;

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
#[derive(Debug)]
pub enum TuiMode {
    FullScreen,
    Inline,
}

#[napi]
#[derive(Clone)]
pub struct AppLifeCycle {
    app: Arc<Mutex<App>>,
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

        Self {
            app: Arc::new(Mutex::new(
                App::new(
                    tasks.into_iter().collect(),
                    initiating_tasks,
                    run_mode,
                    pinned_tasks,
                    rust_tui_config,
                    title_text,
                    task_graph,
                    tui_mode,
                )
                .unwrap(),
            )),
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
        trace!("TUI Mode: {:?}", self.tui_mode);
        
        match self.tui_mode {
            TuiMode::FullScreen => {
                debug!("📺 Initializing FULL-SCREEN TUI");
                self.__init_fullscreen(done_callback)
            }
            TuiMode::Inline => {
                debug!("📱 Initializing INLINE TUI");
                self.__init_inline(done_callback)
            }
        }
    }

    // Unified initialization method for both modes
    fn __init_unified(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
        tui_mode: TuiMode,
    ) -> napi::Result<()> {
        enable_logger();
        debug!("Initializing Terminal UI - Mode: {:?}", tui_mode);

        let app_mutex = self.app.clone();
        let workspace_root = self.workspace_root.clone();

        // Create Tui with appropriate viewport based on mode
        let mut tui = match tui_mode {
            TuiMode::FullScreen => Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?,
            TuiMode::Inline => Tui::new_with_viewport(ratatui::Viewport::Inline(8))
                .map_err(|e| napi::Error::from_reason(e.to_string()))?,
        };
        
        // Enter terminal with appropriate mode
        tui.enter_with_mode(tui_mode)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Set panic hook (identical for both modes)
        std::panic::set_hook(Box::new(move |panic_info| {
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

        // Set rates (identical for both modes)
        tui.tick_rate(10.0);
        tui.frame_rate(60.0);

        // Initialize action channel (identical for both modes)
        let (action_tx, mut action_rx) = tokio::sync::mpsc::unbounded_channel();
        debug!("Initialized Action Channel");

        // Initialize components (identical for both modes)
        let mut app_guard = app_mutex.lock();
        app_guard.set_done_callback(done_callback);
        app_guard.register_action_handler(action_tx.clone()).ok();
        
        for component in app_guard.components.iter_mut() {
            component.register_action_handler(action_tx.clone()).ok();
        }

        app_guard.init(tui.size().unwrap()).ok();
        for component in app_guard.components.iter_mut() {
            component.init(tui.size().unwrap()).ok();
        }
        drop(app_guard);

        debug!("Initialized Components");

        // Spawn unified async task (identical for both modes!)
        napi::tokio::spawn(async move {
            // Set up console messenger (identical for both modes)
            {
                let connection = NxConsoleMessageConnection::new(&workspace_root).await;
                app_mutex.lock().set_console_messenger(connection);
            }

            // UNIFIED EVENT LOOP - works for both modes!
            loop {
                // Handle events using existing App logic
                if let Some(event) = tui.next().await {
                    let mut app = app_mutex.lock();
                    let _ = app.handle_event(event, &action_tx);

                    // Check if we should quit based on the timer
                    if let Some(quit_time) = app.quit_at {
                        if std::time::Instant::now() >= quit_time {
                            tui.exit().ok();
                            app.call_done_callback();
                            break;
                        }
                    }
                }

                // Process actions using existing App logic
                while let Ok(action) = action_rx.try_recv() {
                    app_mutex.lock().handle_action(&mut tui, action, &action_tx);
                }
            }
        });

        Ok(())
    }

    // Private method for full-screen TUI initialization
    fn __init_fullscreen(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        self.__init_unified(done_callback, TuiMode::FullScreen)
    }

    // Private method for inline TUI initialization (updated to use unified logic)
    fn __init_inline(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        self.__init_unified(done_callback, TuiMode::Inline)
    }


    #[napi]
    pub fn register_running_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        self.app
            .lock()
            .register_running_interactive_task(task_id, parser_and_writer)
    }

    #[napi]
    pub fn register_running_task_with_empty_parser(&mut self, task_id: String) {
        self.app
            .lock()
            .register_running_non_interactive_task(task_id)
    }

    #[napi]
    pub fn append_task_output(&mut self, task_id: String, output: String, is_pty_output: bool) {
        // If its from a pty, we already have it in the parser, so we don't need to append it again
        if !is_pty_output {
            self.app.lock().append_task_output(task_id, output)
        }
    }

    #[napi]
    pub fn set_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.app.lock().update_task_status(task_id, status)
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
pub fn restore_terminal() -> Result<()> {
    // Restore the terminal to a clean state
    if let Ok(mut t) = Tui::new() {
        if let Err(r) = t.exit() {
            debug!("Unable to exit Terminal: {:?}", r);
        }
    }
    // TODO: Maybe need some additional cleanup here in addition to the tui cleanup performed at the end of the render loop?
    Ok(())
}
