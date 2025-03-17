use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi::JsObject;
use std::sync::{Arc, Mutex};
use tracing::debug;

use crate::native::logger::enable_logger;
use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};

use super::app::App;
use super::components::tasks_list::TaskStatus;
use super::task::{
    Task as RustTask, TaskOverrides as RustTaskOverrides, TaskResult as RustTaskResult,
    TaskTarget as RustTaskTarget,
};
use super::tui::Tui;
use super::utils::initialize_panic_handler;

#[napi(object)]
#[derive(Clone, serde::Serialize)]
pub struct TaskTarget {
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

impl From<TaskTarget> for RustTaskTarget {
    fn from(js: TaskTarget) -> Self {
        Self {
            project: js.project,
            target: js.target,
            configuration: js.configuration,
        }
    }
}

#[napi(object)]
#[derive(Clone, serde::Serialize)]
pub struct TaskOverrides {}

impl From<TaskOverrides> for RustTaskOverrides {
    fn from(_js: TaskOverrides) -> Self {
        Self {}
    }
}

#[napi(object)]
#[derive(Clone, serde::Serialize)]
pub struct Task {
    pub id: String,
    pub target: TaskTarget,
    #[napi(ts_type = "any")]
    pub overrides: TaskOverrides,
    pub outputs: Vec<String>,
    pub project_root: Option<String>,
    pub hash: Option<String>,
    #[napi(js_name = "startTime")]
    pub start_time: Option<f64>,
    #[napi(js_name = "endTime")]
    pub end_time: Option<f64>,
    pub cache: Option<bool>,
    pub parallelism: bool,
    pub continuous: Option<bool>,
}

impl From<Task> for RustTask {
    fn from(js: Task) -> Self {
        Self {
            id: js.id,
            target: js.target.into(),
            overrides: js.overrides.into(),
            outputs: js.outputs,
            project_root: js.project_root,
            hash: js.hash,
            start_time: js.start_time,
            end_time: js.end_time,
            cache: js.cache,
            parallelism: js.parallelism,
            continuous: js.continuous,
        }
    }
}

#[napi(object)]
#[derive(Clone)]
pub struct TaskResult {
    pub task: Task,
    pub status: String,
    pub code: i32,
    pub terminal_output: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

impl From<TaskResult> for RustTaskResult {
    fn from(js: TaskResult) -> Self {
        Self {
            task: js.task.into(),
            status: js.status.parse().unwrap(),
            code: js.code,
            terminal_output: js.terminal_output,
            start_time: js.start_time,
            end_time: js.end_time,
        }
    }
}

#[napi(object)]
#[derive(Clone)]
pub struct TaskMetadata {
    pub group_id: i32,
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
        nx_args: JsObject,
    ) -> Self {
        // Get the target names from nx_args.targets array
        let target_names: Vec<String> = nx_args
            .get::<_, Vec<String>>("targets")
            .unwrap_or_else(|_| {
                debug!("Failed to get targets from nx_args, defaulting to empty vec");
                vec![].into()
            })
            .unwrap_or_default();

        Self {
            app: Arc::new(std::sync::Mutex::new(
                App::new(tasks.into_iter().map(|t| t.into()).collect(), target_names, pinned_tasks).unwrap(),
            )),
        }
    }

    #[napi]
    pub fn schedule_task(&mut self, _task: Task) -> napi::Result<()> {
        // Always intentional noop
        Ok(())
    }

    #[napi]
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _metadata: JsObject) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.start_tasks(tasks.into_iter().map(|t| t.into()).collect());
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
        _metadata: TaskMetadata,
    ) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            app.end_tasks(task_results.into_iter().map(|r| r.into()).collect());
        }
        Ok(())
    }

    // Rust-only lifecycle method
    #[napi(js_name = "__init")]
    pub fn __init(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        // Initialize logging and panic handlers first
        debug!("Initializing Terminal UI");
        enable_logger();
        initialize_panic_handler().map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Set up better-panic to capture backtraces
        better_panic::install();

        // TODO: refactor this
        // Set up a panic hook that writes to stderr
        std::panic::set_hook(Box::new(move |panic_info| {
            let backtrace = std::backtrace::Backtrace::capture();
            let thread = std::thread::current();
            let thread_name = thread.name().unwrap_or("<unnamed>");
            let msg = format!(
                "\n\nThread '{}' panicked at '{}'\n{:?}\n\n",
                thread_name, panic_info, backtrace
            );
            // Write to stderr
            eprintln!("{}", msg);
        }));

        let app_mutex = self.app.clone();

        // Initialize our Tui abstraction
        let mut tui = Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?;
        tui.enter()
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
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

                        // Check if we should quit
                        if app.should_quit {
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
        });

        Ok(())
    }

    // Rust-only lifecycle method
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
