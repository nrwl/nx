use super::components::{tasks_list, terminal_pane};
use super::task::{
    Task as RustTask, TaskOverrides as RustTaskOverrides, TaskResult as RustTaskResult,
    TaskTarget as RustTaskTarget,
};
use super::utils::initialize_panic_handler;
use super::{
    action::Action,
    app::Focus,
    components::{help_popup::HelpPopup, tasks_list::TasksList},
};
use super::{app, pty, task, tui};
use crate::native::logger::enable_logger;
use crate::native::tui::app::App;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use napi::JsObject;
use ratatui::{
    layout::{Alignment, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tasks_list::TaskStatus;
use tracing::debug;

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
}

impl From<TaskResult> for RustTaskResult {
    fn from(js: TaskResult) -> Self {
        Self {
            task: js.task.into(),
            status: js.status.parse().unwrap(),
            code: js.code,
            terminal_output: js.terminal_output,
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
        _project_names: Vec<String>,
        tasks: Vec<Task>,
        nx_args: JsObject,
        _overrides: JsObject,
    ) -> Self {
        // Convert NAPI tasks to internal tasks
        let internal_tasks: Vec<task::Task> = tasks.into_iter().map(|t| t.into()).collect();

        // Get the target names from nx_args.targets array
        let target_names: Vec<String> = nx_args
            .get::<_, Vec<String>>("targets")
            .unwrap_or_else(|_| {
                debug!("Failed to get targets from nx_args, defaulting to empty vec");
                vec![].into()
            })
            .unwrap_or_default();

        // Create app with converted tasks and empty command lookup
        Self {
            app: std::sync::Arc::new(std::sync::Mutex::new(
                app::App::new(10.0, 60.0, internal_tasks, target_names).unwrap(),
            )),
        }
    }

    #[napi]
    pub fn init(
        &self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) -> napi::Result<()> {
        // Initialize logging and panic handlers first
        debug!("Initializing Terminal UI");
        enable_logger();
        initialize_panic_handler().map_err(|e| napi::Error::from_reason(e.to_string()))?;

        // Set up better-panic to capture backtraces
        better_panic::install();

        // Create a file to capture panic output
        let log_file = std::fs::File::create("nxr-panic.log")
            .map_err(|e| napi::Error::from_reason(format!("Failed to create log file: {}", e)))?;
        let log_file = std::sync::Arc::new(std::sync::Mutex::new(log_file));

        // Set up a panic hook that writes to both stderr and our log file
        let log_file_clone = log_file.clone();
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

            // Also write to our log file
            if let Ok(mut file) = log_file_clone.lock() {
                use std::io::Write;
                let _ = writeln!(file, "{}", msg);
                let _ = file.flush();
            }
        }));

        let app_mutex = self.app.clone();

        // Initialize our Tui abstraction
        let mut tui = tui::Tui::new().map_err(|e| napi::Error::from_reason(e.to_string()))?;
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

    #[napi]
    pub fn schedule_task(&mut self, _task: Task) -> napi::Result<()> {
        // Always intentional noop
        Ok(())
    }

    #[napi]
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _metadata: JsObject) -> napi::Result<()> {
        if let Ok(mut app) = self.app.lock() {
            // Find the TasksList component
            if let Some(tasks_list) = app
                .components
                .iter_mut()
                .find_map(|c| c.as_any_mut().downcast_mut::<tasks_list::TasksList>())
            {
                tasks_list.start_tasks(tasks.into_iter().map(|t| t.into()).collect());
            }
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
        // Convert the status string to our TaskStatus enum
        let task_status = status
            .parse()
            .map_err(|e| napi::Error::from_reason(format!("Invalid task status: {}.", e)))?;

        // We only want to react to this lifecycle hook in the case of cache restoration. Otherwise exit early,
        // because the pty created during __runCommandsForTask will be in charge of the terminal output.
        if !matches!(
            task_status,
            TaskStatus::LocalCache | TaskStatus::LocalCacheKeptExisting | TaskStatus::RemoteCache
        ) {
            return Ok(());
        }
        if let Ok(mut app) = self.app.lock() {
            // Find the TasksList component
            if let Some(tasks_list) = app
                .components
                .iter_mut()
                .find_map(|c| c.as_any_mut().downcast_mut::<tasks_list::TasksList>())
            {
                tasks_list.complete_cached_task(&task.id, task_status, Some(&output));
            }
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
            // Find the TasksList component
            if let Some(tasks_list) = app
                .components
                .iter_mut()
                .find_map(|c| c.as_any_mut().downcast_mut::<tasks_list::TasksList>())
            {
                tasks_list.end_tasks(task_results.into_iter().map(|r| r.into()).collect());
            }
        }
        Ok(())
    }

    // New lifecycle method to handle task execution in rust
    #[napi(js_name = "__runCommandsForTask")]
    pub async fn __run_commands_for_task(
        &self,
        task: Task,
        options: NormalizedRunCommandsOptions,
    ) -> napi::Result<RunningTask> {
        // Get terminal size for PTY
        let terminal_size = crossterm::terminal::size().unwrap_or((80, 24));
        let (width, height) = terminal_size;

        // Calculate dimensions using the same logic as handle_resize
        let output_width = (width / 3) * 2; // Two-thirds of width for PTY panes
        let area = ratatui::layout::Rect::new(0, 0, output_width, height);

        // Use TerminalPane to calculate dimensions
        let (pty_height, pty_width) = terminal_pane::TerminalPane::calculate_pty_dimensions(area);

        let command = options
            .commands
            .first()
            .map(|c| c.command.as_str())
            .unwrap_or("");

        // Create a PTY instance with the command
        let pty = pty::PtyInstance::new(
            pty_height,
            pty_width,
            command,
            options.cwd.as_deref(), // Pass working directory if specified
            options.env.as_ref(),   // Pass environment variables if specified
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to create PTY: {}", e)))?;

        // Clone PTY for the monitoring task
        let pty_clone = pty.clone();

        // Update the task in tasks list with the pty instance
        if let Ok(mut app) = self.app.lock() {
            if let Some(tasks_list) = app
                .components
                .iter_mut()
                .find_map(|c| c.as_any_mut().downcast_mut::<tasks_list::TasksList>())
            {
                tasks_list.update_task_pty(task.id.clone(), pty);
            }
        }

        let mut running_task = RunningTask {
            task,
            app: self.app.clone(),
            exit_callback: None,
        };

        // Create an Arc to share the callback between threads
        let callback = std::sync::Arc::new(std::sync::Mutex::new(
            None::<ThreadsafeFunction<(i32, String), ErrorStrategy::Fatal>>,
        ));
        let callback_clone = callback.clone();

        // Store the callback in the running task
        running_task.exit_callback = Some(callback);

        // Spawn a task to monitor the PTY exit status
        napi::tokio::spawn(async move {
            loop {
                if let Some(exit_code) = pty_clone.get_exit_status() {
                    // Get the final output from the PTY
                    let terminal_output = if let Some(screen) = pty_clone.get_screen() {
                        screen.all_contents_formatted()
                    } else {
                        Vec::new()
                    };
                    let terminal_output = String::from_utf8_lossy(&terminal_output).into_owned();

                    // Call the exit callback if it exists
                    if let Ok(cb) = callback_clone.lock() {
                        if let Some(cb) = &*cb {
                            cb.call(
                                (exit_code, terminal_output),
                                napi::threadsafe_function::ThreadsafeFunctionCallMode::Blocking,
                            );
                        }
                    }
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        });

        Ok(running_task)
    }
}

#[napi]
pub fn restore_terminal() -> Result<()> {
    // TODO: Maybe need some additional cleanup here in addition to the tui cleanup performed at the end of the render loop?
    Ok(())
}

#[napi]
pub struct RunningTask {
    task: Task,
    app: Arc<Mutex<App>>,
    exit_callback: Option<
        Arc<
            Mutex<Option<ThreadsafeFunction<(i32, String), ErrorStrategy::Fatal>>>,
        >,
    >,
}

#[napi]
impl RunningTask {
    /**
     * Get results always needs the up to date pty instance, so we can't embed this in the __runCommandsForTask
     * method, and instead need to look up the pty instance in the TasksList component.
     */
    #[napi(ts_return_type = "Promise<{ code: number; terminalOutput: string }>")]
    pub async fn get_results(&self) -> napi::Result<TaskOutput> {
        // Get PTY instance and drop mutex guard immediately
        let pty = {
            if let Ok(app) = self.app.lock() {
                if let Some(tasks_list) = app
                    .components
                    .iter()
                    .find_map(|c| c.as_any().downcast_ref::<tasks_list::TasksList>())
                {
                    tasks_list.get_active_pty_for_task(&self.task.id).cloned()
                } else {
                    None
                }
            } else {
                None
            }
        };

        if let Some(pty) = pty {
            // Wait for exit status in a loop
            loop {
                if let Some(exit_code) = pty.get_exit_status() {
                    // Get the terminal output
                    let terminal_output = if let Some(screen) = pty.get_screen() {
                        String::from_utf8_lossy(&screen.all_contents_formatted()).into_owned()
                    } else {
                        String::new()
                    };

                    return Ok(TaskOutput {
                        code: exit_code,
                        terminal_output,
                    });
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }

        // Return default values if we couldn't get the results
        Ok(TaskOutput {
            code: 0,
            terminal_output: String::new(),
        })
    }

    #[napi]
    pub fn on_exit(&mut self, callback: ThreadsafeFunction<(i32, String), ErrorStrategy::Fatal>) {
        if let Some(cb_mutex) = &self.exit_callback {
            if let Ok(mut cb) = cb_mutex.lock() {
                *cb = Some(callback);
            }
        }
    }

    #[napi(ts_return_type = "Promise<void>")]
    pub async fn kill(&self, signal: Option<i32>) -> napi::Result<()> {
        // TODO: Implement task killing
        Ok(())
    }
}

// TODO: Is there a way in napi to not generate this in the typings? It does not need to be a named type on the TS side.
#[napi(object)]
#[derive(Clone)]
pub struct TaskOutput {
    pub code: i32,
    pub terminal_output: String,
}

#[napi(object)]
#[derive(Clone)]
pub struct NormalizedCommandOptions {
    pub command: String,
    #[napi(js_name = "forwardAllArgs")]
    pub forward_all_args: Option<bool>,
}

#[napi(object)]
#[derive(Clone)]
pub struct ReadyWhenStatus {
    #[napi(js_name = "stringToMatch")]
    pub string_to_match: String,
    pub found: bool,
}

#[napi(object)]
pub struct NormalizedRunCommandsOptions {
    // Fields from the normalized extension
    pub commands: Vec<NormalizedCommandOptions>,
    #[napi(js_name = "unknownOptions")]
    pub unknown_options: Option<HashMap<String, serde_json::Value>>,
    #[napi(js_name = "parsedArgs")]
    pub parsed_args: HashMap<String, serde_json::Value>,
    #[napi(js_name = "unparsedCommandArgs")]
    pub unparsed_command_args: Option<HashMap<String, serde_json::Value>>,
    pub args: Option<String>,
    #[napi(js_name = "readyWhenStatus")]
    pub ready_when_status: Vec<ReadyWhenStatus>,

    // Fields from the base RunCommandsOptions
    #[napi(ts_type = "string | string[]")]
    pub command: Option<Either<String, Vec<String>>>,
    pub color: Option<bool>,
    pub parallel: Option<bool>,
    #[napi(js_name = "readyWhen")]
    pub ready_when: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    #[napi(js_name = "forwardAllArgs")]
    pub forward_all_args: Option<bool>,
    #[napi(js_name = "envFile")]
    pub env_file: Option<String>,
    #[napi(js_name = "__unparsed__")]
    pub unparsed: Vec<String>,
    #[napi(js_name = "usePty")]
    pub use_pty: Option<bool>,
    #[napi(js_name = "streamOutput")]
    pub stream_output: Option<bool>,
    pub tty: Option<bool>,
}
