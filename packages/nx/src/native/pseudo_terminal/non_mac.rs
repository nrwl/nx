use nx_pty::pseudo_terminal::{create_pseudo_terminal, os, run_command, PseudoTerminal};
use std::collections::HashMap;

use nx_logger::enable_logger;

use nx_pty::pseudo_terminal::child_process::ChildProcess;
use tracing::trace;

#[napi]
pub struct RustPseudoTerminal {
    pseudo_terminal: PseudoTerminal,
}

#[napi]
impl RustPseudoTerminal {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        enable_logger();

        let pseudo_terminal = create_pseudo_terminal()?;

        Ok(Self { pseudo_terminal })
    }

    #[napi]
    pub fn run_command(
        &self,
        command: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        quiet: Option<bool>,
        tty: Option<bool>,
    ) -> napi::Result<ChildProcess> {
        run_command(
            &self.pseudo_terminal,
            command,
            command_dir,
            js_env,
            exec_argv,
            quiet,
            tty,
        )
    }

    /// This allows us to run a pseudoterminal with a fake node ipc channel
    /// this makes it possible to be backwards compatible with the old implementation
    #[napi]
    pub fn fork(
        &self,
        id: String,
        fork_script: String,
        pseudo_ipc_path: String,
        command_dir: Option<String>,
        js_env: Option<HashMap<String, String>>,
        exec_argv: Option<Vec<String>>,
        quiet: bool,
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
        )
    }
}
