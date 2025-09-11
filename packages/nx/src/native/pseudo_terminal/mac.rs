use std::collections::HashMap;
use std::sync::Arc;
use tracing::trace;
use tokio::runtime::Runtime;

use super::child_process::ChildProcess;
use super::os;
use super::pseudo_terminal::{PseudoTerminal, PseudoTerminalOptions};
use crate::native::logger::enable_logger;

#[napi]
pub struct RustPseudoTerminal {
    pseudo_terminal: PseudoTerminal,
}

#[napi]
impl RustPseudoTerminal {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        enable_logger();

        let pseudo_terminal = PseudoTerminal::new(PseudoTerminalOptions::default())?;

        Ok(Self { pseudo_terminal })
    }

    #[napi]
    pub fn run_command(
        &mut self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        quiet: Option<bool>,
        tty: Option<bool>,
        command_label: Option<String>,
    ) -> napi::Result<ChildProcess> {
        self.pseudo_terminal.run_command(
            command,
            command_dir,
            js_env,
            exec_argv,
            quiet,
            tty,
            command_label,
        )
    }

    /// This allows us to run a pseudoterminal with a fake node ipc channel
    /// this makes it possible to be backwards compatible with the old implementation
    #[napi]
    pub fn fork(
        &mut self,
        id: String,
        fork_script: String,
        pseudo_ipc_path: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        quiet: bool,
        command_label: Option<String>,
    ) -> napi::Result<ChildProcess> {
        let command = format!(
            "node {} {} {}",
            os::handle_path_space(fork_script),
            pseudo_ipc_path,
            id
        );

        trace!("nx_fork command: {}", &command);
        self.run_command(
            command,
            command_dir,
            js_env,
            exec_argv,
            Some(quiet),
            Some(true),
            command_label,
        )
    }

    /// Run a command with inline TUI mode that shows progress below the command output
    #[napi]
    pub fn run_command_with_inline_tui(
        &mut self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        command_label: Option<String>,
        enable_inline_tui: Option<bool>,
    ) -> napi::Result<ChildProcess> {
        if !enable_inline_tui.unwrap_or(false) {
            // If inline TUI is not enabled, just run the command normally
            return self.run_command(
                command,
                command_dir,
                js_env,
                exec_argv,
                Some(false),
                Some(true),
                command_label,
            );
        }

        trace!("Running command with inline TUI: {}", command);
        
        // Create a simple task list for the inline TUI
        let tasks = vec![crate::native::tasks::types::Task {
            id: command_label.clone().unwrap_or_else(|| String::from("task")),
            target: crate::native::tasks::types::TaskTarget {
                project: String::from("project"),
                target: String::from("run"),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some(command_dir.clone().unwrap_or_else(|| String::from("."))),
            start_time: None,
            end_time: None,
            continuous: Some(false),
        }];
        
        // Create inline TUI instance
        let mut inline_tui = crate::native::tui::inline_tui::InlineTui::new(tasks)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        
        // Create PTY instance for screen content access like terminal_pane.rs
        trace!("Creating PTY instance for inline TUI with parser and writer");
        let pty = Arc::new(crate::native::tui::pty::PtyInstance::interactive(
            self.pseudo_terminal.parser.clone(),
            self.pseudo_terminal.writer.clone(),
        ));
        inline_tui.set_pty(pty);
        trace!("PTY instance created and set for inline TUI");
        
        // Run the command through pseudo_terminal  
        let child = self.pseudo_terminal.run_command(
            command.clone(),
            command_dir,
            js_env,
            exec_argv,
            Some(true),  // quiet = true, inline TUI will handle output display
            None,        // tty = auto-detect
            command_label.clone(),
        )?;
        
        // Notify that the task has started
        let task_id = command_label.clone().unwrap_or_else(|| String::from("task"));
        inline_tui.notify_task_started(task_id.clone());
        
        // Set up output handler to forward output from pseudo_terminal to inline TUI
        let event_sender = inline_tui.get_event_sender();
        let stdout_rx = self.pseudo_terminal.stdout_rx.clone();
        let output_task_id = task_id.clone();
        
        std::thread::spawn(move || {
            // Forward all output from pseudo_terminal to inline TUI
            while let Ok(output) = stdout_rx.recv() {
                let _ = event_sender.send(crate::native::tui::inline_tui::InlineEvent::TaskOutput(
                    output_task_id.clone(),
                    output,
                ));
            }
        });
        
        // Set up exit handler
        let exit_rx = child.wait_receiver.clone();
        let event_sender = inline_tui.get_event_sender();
        let exit_task_id = task_id.clone();
        
        std::thread::spawn(move || {
            if let Ok(exit_code_str) = exit_rx.recv() {
                let exit_code: i32 = exit_code_str.parse().unwrap_or(-1);
                let success = exit_code == 0;
                
                // Notify inline TUI that the task completed
                let _ = event_sender.send(crate::native::tui::inline_tui::InlineEvent::TaskCompleted(
                    exit_task_id,
                    success,
                ));
                
                // Give time for the final UI update then quit
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = event_sender.send(crate::native::tui::inline_tui::InlineEvent::Quit);
            }
        });
        
        // Run the inline TUI in a separate thread
        trace!("Creating tokio runtime for inline TUI");
        let runtime = Runtime::new()
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        
        trace!("Spawning inline TUI thread");
        std::thread::spawn(move || {
            trace!("Inside inline TUI thread, about to start runtime");
            runtime.block_on(async {
                trace!("Inside async block, calling inline_tui.run()");
                match inline_tui.run().await {
                    Ok(()) => trace!("Inline TUI completed successfully"),
                    Err(e) => trace!("Inline TUI failed with error: {}", e),
                }
            });
            trace!("Inline TUI thread exiting");
        });

        Ok(child)
    }
}
