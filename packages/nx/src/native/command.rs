use anyhow::anyhow;
use std::collections::HashMap;

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use smol::io::{AsyncReadExt, AsyncWriteExt};
use tracing::trace;

fn command_builder() -> CommandBuilder {
    if cfg!(target_os = "windows") {
        let comspec = std::env::var("COMSPEC");
        let shell = comspec
            .as_ref()
            .map(|v| v.as_str())
            .unwrap_or_else(|_| "cmd.exe");
        let mut command = CommandBuilder::new(shell);
        command.arg("/C");
        command
    } else {
        let mut command = CommandBuilder::new("sh");
        command.arg("-c");
        command
    }
}

#[napi]
pub async fn run_command(
    command: String,
    command_dir: Option<String>,
    ready_when: Option<String>,
    js_env: Option<HashMap<String, String>>,
) -> napi::Result<u32> {
    let command_dir = command_dir
        .ok_or_else(std::env::current_dir)
        .map_err(|_| anyhow!("failed to get current directory"))?;

    let pty_system = NativePtySystem::default();

    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = command_builder();
    cmd.arg(command.as_str());
    cmd.cwd(command_dir);

    if let Some(js_env) = js_env {
        for (key, value) in js_env {
            cmd.env(key, value);
        }
    }

    let mut child = pair.slave.spawn_command(cmd)?;

    // Release any handles owned by the slave
    // we don't need it now that we've spawned the child.
    drop(pair.slave);

    let reader = pair.master.try_clone_reader()?;
    let mut reader = smol::io::BufReader::new(smol::Unblock::new(reader));
    let mut stdout = smol::io::BufWriter::new(smol::Unblock::new(std::io::stdout()));
    let mut buffer = [0; 8 * 1024];

    let mut ready_when_check = false;

    while let Ok(n) = reader.read(&mut buffer).await {
        if n == 0 {
            break;
        }

        stdout.write_all(&buffer[..n]).await?;
        stdout.flush().await?;

        if let Some(ready_when) = ready_when.as_ref() {
            let buffer = std::str::from_utf8(&buffer[..n]).unwrap_or("");
            buffer.contains(ready_when);
            ready_when_check = true;
            break;
        }
    }

    if ready_when_check {
        return Ok(0);
    };

    // Wait for the child to complete
    let status = child.wait()?;

    trace!(?command, ?status);
    Ok(status.exit_code())
}
