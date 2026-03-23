use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows API constant to prevent creating a visible console window.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Creates a `Command` for the given program with `CREATE_NO_WINDOW` set on Windows.
/// Use this instead of `Command::new()` directly to avoid spawning visible
/// console windows from background/daemon processes.
pub fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Creates a shell `Command` (`cmd /C` on Windows, `sh -c` elsewhere)
/// with `CREATE_NO_WINDOW` set on Windows.
pub fn create_shell_command() -> Command {
    if cfg!(target_os = "windows") {
        let comspec = std::env::var("COMSPEC");
        let shell = comspec
            .as_ref()
            .map(|v| v.as_str())
            .unwrap_or_else(|_| "cmd.exe");
        let mut command = create_command(shell);
        command.arg("/C");
        command
    } else {
        let mut command = create_command("sh");
        command.arg("-c");
        command
    }
}
