use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi::JsObject;
use std::sync::{Arc, Mutex};
use tracing::debug;

use crate::native::logger::enable_logger;
use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};
use crate::native::tasks::types::{Task, TaskResult};

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
        RustTuiConfig::new(js_auto_exit, &rust_tui_cli_args)
    }
}

#[napi]
#[derive(Clone)]
pub struct AppLifeCycle {
    app: Arc<Mutex<App>>,
}

#[napi]
impl AppLifeCycle {
    #[napi(constructor)]
    pub fn new(
        tasks: Vec<Task>,
        pinned_tasks: Vec<String>,
        tui_cli_args: TuiCliArgs,
        tui_config: TuiConfig,
        title_text: String,
    ) -> Self {
        // Get the target names from nx_args.targets
        let rust_tui_cli_args = tui_cli_args.into();

        // Convert JSON TUI configuration to our Rust TuiConfig
        let rust_tui_config = RustTuiConfig::from((tui_config, &rust_tui_cli_args));

        Self {
            app: Arc::new(std::sync::Mutex::new(
                App::new(
                    tasks.into_iter().map(|t| t.into()).collect(),
                    pinned_tasks,
                    rust_tui_config,
                    title_text,
                )
                .unwrap(),
            )),
        }
    }

    #[napi]
    pub fn start_command(&mut self, thread_count: Option<u32>) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.start_command(thread_count);
        }
        Ok(())
    }

    #[napi]
    pub fn schedule_task(&mut self, _task: Task) -> napi::Result<()> {
        // Always intentional noop
        Ok(())
    }

    #[napi]
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _metadata: JsObject) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.start_tasks(tasks);
        }
        Ok(())
    }

    #[napi]
    pub fn print_task_terminal_output(
        &mut self,
        task: Task,
        status: String,
        output: String,
    ) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.print_task_terminal_output(task.id, status.parse().unwrap(), output);
        }
        Ok(())
    }

    #[napi]
    pub fn end_tasks(
        &mut self,
        task_results: Vec<TaskResult>,
        _metadata: JsObject,
    ) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.end_tasks(task_results);
        }
        Ok(())
    }

    #[napi]
    pub fn end_command(&self) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.end_command();
        }
        Ok(())
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__init")]
    pub fn __init(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        debug!("Initializing Terminal UI");
        enable_logger();

        let app_mutex = self.app.clone();

        // Initialize our Tui abstraction
        let mut tui = Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?;
        tui.enter()
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;

        std::panic::set_hook(Box::new(move |panic_info| {
            // Restore the terminal to a clean state
            if let Ok(mut t) = Tui::new() {
                if let Err(r) = t.exit() {
                    debug!("Unable to exit Terminal: {:?}", r);
                }
            }
            // Capture detailed backtraces in development, more concise in production
            better_panic::Settings::auto()
                .most_recent_first(false)
                .lineno_suffix(true)
                .verbosity(better_panic::Verbosity::Full)
                .create_panic_handler()(panic_info);
        }));

        debug!("Initialized Terminal UI");

        // Set tick and frame rates
        tui.tick_rate(10.0);
        tui.frame_rate(60.0);

        // Initialize action channel
        let (action_tx, mut action_rx) = tokio::sync::mpsc::unbounded_channel();
        debug!("Initialized Action Channel");

        // Initialize components
        if let Ok(mut app) = app_mutex.lock() {
            // Store callback for cleanup
            app.set_done_callback(done_callback);

            for component in app.components.iter_mut() {
                component.register_action_handler(action_tx.clone()).ok();
                component.init().ok();
            }
        }
        debug!("Initialized Components");

        napi::tokio::spawn(async move {
            loop {
                // Handle events using our Tui abstraction
                if let Some(event) = tui.next().await {
                    if let Ok(mut app) = app_mutex.lock() {
                        if let Ok(true) = app.handle_event(event, &action_tx) {
                            tui.exit().ok();
                            app.call_done_callback();
                            break;
                        }
                    }
                }

                // Process actions
                while let Ok(action) = action_rx.try_recv() {
                    if let Ok(mut app) = app_mutex.lock() {
                        app.handle_action(&mut tui, action, &action_tx);

                        // Check if we should quit based on the timer
                        if let Some(quit_time) = app.quit_at {
                            if std::time::Instant::now() >= quit_time {
                                debug!("Quitting TUI");
                                tui.stop().ok();
                                debug!("Exiting TUI");
                                tui.exit().ok();
                                debug!("Calling exit callback");
                                app.call_done_callback();
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }

    #[napi]
    pub fn register_running_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        let mut app = self.app.lock().unwrap();

        app.register_running_task(task_id, parser_and_writer, TaskStatus::InProgress)
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__setCloudMessage")]
    pub async fn __set_cloud_message(&self, message: String) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            let _ = app.set_cloud_message(Some(message));
        }
        Ok(())
    }
}

#[napi]
pub fn restore_terminal() -> Result<()> {
    // TODO: Maybe need some additional cleanup here in addition to the tui cleanup performed at the end of the render loop?
    Ok(())
}
