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

    // Check if we got extension list in stdout even if command failed
    // This handles the VS Code Insiders crash that happens after listing extensions
    if !stdout.is_empty() {
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

    // Log the error output for debugging if no stdout
    if !output.status.success() {
        debug!("Command failed with status: {:?}", output.status);
        if !stderr.is_empty() {
            trace!("Command stderr: {}", stderr.trim());
        }
    }

    // No output or command failed without output, assume not installed
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

    let current_editor = get_current_editor();
    debug!("Detected editor: {:?}", current_editor);

    can_install_nx_console_for_supported_editor(&current_editor)
}

#[napi]
pub fn can_install_nx_console_for_editor(editor: String) -> bool {
    enable_logger();

    let parsed_editor = parse_editor_string(&editor);
    debug!(
        "Checking if Nx Console can be installed for editor: {:?}",
        parsed_editor
    );

    can_install_nx_console_for_supported_editor(&parsed_editor)
}

#[napi]
pub fn install_nx_console() {
    enable_logger();

    let current_editor = get_current_editor();
    debug!("Detected editor: {:?}", current_editor);

    install_nx_console_for_supported_editor(&current_editor);
}

#[napi]
pub fn install_nx_console_for_editor(editor: String) {
    enable_logger();

    let parsed_editor = parse_editor_string(&editor);
    install_nx_console_for_supported_editor(&parsed_editor);
}

fn can_install_nx_console_for_supported_editor(editor: &SupportedEditor) -> bool {
    if let Some(command) = get_command_for_editor(&editor) {
        if let Ok(installed) = is_nx_console_installed(&command) {
            !installed // Can install if NOT installed
        } else {
            false
        }
    } else {
        false
    }
}

fn install_nx_console_for_supported_editor(editor: &SupportedEditor) {
    if let Some(command) = get_command_for_editor(&editor) {
        // Try to install the extension
        if let Err(e) = install_extension(command) {
            debug!("Failed to install Nx Console extension: {}", e);
        }
    }
}

fn get_command_for_editor(editor: &SupportedEditor) -> Option<&'static str> {
    // Check if installation should be skipped
    let skip_install = std::env::var("NX_SKIP_VSCODE_EXTENSION_INSTALL")
        .map(|v| v == "true")
        .unwrap_or(false);

    if skip_install {
        debug!("Nx Console extension installation disabled via NX_SKIP_VSCODE_EXTENSION_INSTALL");
        return None;
    }

    // Check for dev container environment variables
    let dev_container_vars = ["CODESPACES", "DEVCONTAINER", "REMOTE_CONTAINERS"];
    for var in &dev_container_vars {
        if std::env::var(var).is_ok() {
            debug!(
                "Nx Console extension installation skipped - detected dev container environment variable: {}",
                var
            );
            return None;
        }
    }

    match editor {
        SupportedEditor::VSCode => {
            #[cfg(target_os = "windows")]
            {
                Some("code.cmd")
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some("code")
            }
        }
        SupportedEditor::VSCodeInsiders => {
            #[cfg(target_os = "windows")]
            {
                Some("code-insiders.cmd")
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some("code-insiders")
            }
        }
        SupportedEditor::Cursor => {
            if cfg!(target_os = "windows") {
                Some("cursor.cmd")
            } else if cfg!(target_os = "macos") {
                Some("cursor")
            } else {
                debug!("Cursor extension installation not supported on this platform");
                None
            }
        }
        SupportedEditor::Windsurf => {
            #[cfg(target_os = "windows")]
            {
                Some("windsurf.cmd")
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some("windsurf")
            }
        }
        _ => None,
    }
}

fn parse_editor_string(editor: &str) -> SupportedEditor {
    match editor.to_lowercase().as_str() {
        "vscode" => SupportedEditor::VSCode,
        "vscode-insiders" => SupportedEditor::VSCodeInsiders,
        "cursor" => SupportedEditor::Cursor,
        "windsurf" => SupportedEditor::Windsurf,
        "jetbrains" => SupportedEditor::JetBrains,
        _ => SupportedEditor::Unknown,
    }
}
