use crate::native::ide::detection::{SupportedEditor, get_current_editor};
use crate::native::logger::enable_logger;
use napi::Error;
use std::process::Command;
use tracing::{debug, info, trace};

const NX_CONSOLE_EXTENSION_ID: &str = "nrwl.angular-console";

fn is_nx_console_installed(command: &str) -> Result<bool, Error> {
    debug!(
        "Checking if Nx Console extension is installed with: {} --list-extensions",
        command
    );

    let output = match Command::new(command).arg("--list-extensions").output() {
        Ok(output) => output,
        Err(e) => match e.kind() {
            std::io::ErrorKind::NotFound => {
                debug!(
                    "Command '{}' not found, cannot check extension status",
                    command
                );
                return Ok(false);
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
        let is_installed = stdout
            .lines()
            .any(|line| line.trim() == NX_CONSOLE_EXTENSION_ID);
        if is_installed {
            debug!("Nx Console extension is installed");
        } else {
            debug!("Nx Console extension is not installed");
        }
        return Ok(is_installed);
    }

    // Log the error output for debugging
    debug!("Command failed with status: {:?}", output.status);
    if !stdout.is_empty() {
        trace!("Command stdout: {}", stdout.trim());
    }
    if !stderr.is_empty() {
        trace!("Command stderr: {}", stderr.trim());
    }

    // Command failed, assume not installed
    Ok(false)
}

fn install_extension(command: &str) -> Result<(), Error> {
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
            info!("Successfully installed Nx Console");
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
pub fn can_install_nx_console() -> bool {
    enable_logger();

    if let Some(command) = get_install_command() {
        if let Ok(installed) = is_nx_console_installed(command) {
            !installed
        } else {
            false
        }
    } else {
        false
    }
}

pub fn get_install_command() -> Option<&'static str> {
    // Check if installation should be skipped
    let skip_install = std::env::var("NX_SKIP_VSCODE_EXTENSION_INSTALL")
        .map(|v| v == "true")
        .unwrap_or(false);

    if skip_install {
        debug!("Nx Console extension installation disabled via NX_SKIP_VSCODE_EXTENSION_INSTALL");
        return None;
    }

    // Use the sophisticated editor detection from nx_console
    let current_editor = get_current_editor();
    debug!("Detected editor: {:?}", current_editor);

    match current_editor {
        SupportedEditor::VSCode => {
            debug!("Installing Nx Console extension for VS Code");
            #[cfg(target_os = "windows")]
            {
                Some("code.cmd")
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some("code")
            }
        }
        SupportedEditor::Windsurf => {
            debug!("Installing Nx Console extension for Windsurf");
            #[cfg(target_os = "windows")]
            {
                Some("windsurf.cmd")
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some("windsurf")
            }
        }
        editor => {
            trace!(
                "Unknown editor ({editor:?}) detected, skipping Nx Console extension installation"
            );
            None
        }
    }
}

#[napi]
pub fn install_nx_console() {
    enable_logger();

    if let Some(command) = get_install_command() {
        // Try to install the extension
        if let Err(e) = install_extension(command) {
            debug!("Failed to install Nx Console extension: {}", e);
        }
    }
}
