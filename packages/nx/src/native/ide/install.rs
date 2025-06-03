use crate::native::ide::detection::{SupportedEditor, get_current_editor};
use crate::native::logger::enable_logger;
use napi::Error;
use std::process::Command;
use tracing::{debug, info, trace};

const NX_CONSOLE_EXTENSION_ID: &str = "nrwl.angular-console";

fn install_nx_console(command: &str) -> Result<(), Error> {
    debug!(
        "Attempting to install Nx Console extension with: {} --install-extension {}",
        command, NX_CONSOLE_EXTENSION_ID
    );

    let output = match Command::new(command)
        .arg("--install-extension")
        .arg(NX_CONSOLE_EXTENSION_ID)
        .output()
    {
        Ok(output) => output,
        Err(e) => match e.kind() {
            std::io::ErrorKind::NotFound => {
                debug!(
                    "Command '{}' not found, skipping extension installation",
                    command
                );
                return Ok(());
            }
            _ => {
                debug!("Failed to execute command: {}", e);
                return Err(Error::from_reason(format!(
                    "Failed to run command '{}': {}",
                    command, e
                )));
            }
        },
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        if stdout.contains("already installed") {
            debug!("Nx Console extension is already installed");
        } else {
            info!("Successfully installed Nx Console extension");
        }
        trace!("Command output: {}", stdout.trim());
        return Ok(());
    }

    // Check for "already installed" message in stdout or stderr
    let combined_output = format!("{} {}", stdout, stderr);
    if combined_output.contains("already installed") {
        debug!("Nx Console extension is already installed");
        return Ok(());
    }

    // Log the error output for debugging
    debug!("Command failed with status: {:?}", output.status);
    if !stdout.is_empty() {
        trace!("Command stdout: {}", stdout.trim());
    }
    if !stderr.is_empty() {
        trace!("Command stderr: {}", stderr.trim());
    }

    // Command failed but this is OK - we don't want to crash Nx
    Ok(())
}

#[napi]
pub fn ensure_nx_console_installed() {
    enable_logger();

    // Check if installation should be skipped
    let skip_install = std::env::var("NX_SKIP_VSCODE_EXTENSION_INSTALL")
        .map(|v| v == "true")
        .unwrap_or(false);

    if skip_install {
        debug!("Nx Console extension installation disabled via NX_SKIP_VSCODE_EXTENSION_INSTALL");
        return;
    }

    // Use the sophisticated editor detection from nx_console
    let current_editor = get_current_editor();
    debug!("Detected editor: {:?}", current_editor);

    let command = match current_editor {
        SupportedEditor::VSCode => {
            debug!("Installing Nx Console extension for VS Code");
            #[cfg(target_os = "windows")]
            {
                "code.cmd"
            }
            #[cfg(not(target_os = "windows"))]
            {
                "code"
            }
        }
        SupportedEditor::Windsurf => {
            debug!("Installing Nx Console extension for Windsurf");
            #[cfg(target_os = "windows")]
            {
                "windsurf.cmd"
            }
            #[cfg(not(target_os = "windows"))]
            {
                "windsurf"
            }
        }
        editor => {
            trace!(
                "Unknown editor ({editor:?}) detected, skipping Nx Console extension installation"
            );
            return;
        }
    };

    // Try to install the extension
    if let Err(e) = install_nx_console(command) {
        debug!("Failed to install Nx Console extension: {}", e);
    }
}
