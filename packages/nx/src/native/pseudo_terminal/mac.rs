use std::collections::HashMap;
use tracing::trace;

use super::child_process::ChildProcess;
use super::os;
use super::pseudo_terminal::{PseudoTerminal, PseudoTerminalOptions};

#[napi]
pub struct RustPseudoTerminal {
    pseudo_terminal: PseudoTerminal,
}

#[napi]
impl RustPseudoTerminal {
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
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
        let command = format!("node {}", os::handle_path_space(fork_script));

        let mut js_env = js_env.unwrap_or_default();
        js_env.insert("NX_PSEUDO_IPC_PATH".to_string(), pseudo_ipc_path);
        js_env.insert("NX_PSEUDO_IPC_FORK_ID".to_string(), id);

        trace!("nx_fork command: {}", &command);
        self.run_command(
            command,
            command_dir,
            Some(js_env),
            exec_argv,
            Some(quiet),
            Some(true),
            command_label,
        )
    }
}
