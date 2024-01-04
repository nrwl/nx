use anyhow::anyhow;
use napi::JsFunction;
use std::sync::Arc;
use std::{
    collections::HashMap,
    io::{BufReader, BufWriter, Read, Write},
};

use portable_pty::{Child, CommandBuilder, ExitStatus, NativePtySystem, PtySize, PtySystem};
use tokio::sync::mpsc::{channel, Receiver, Sender};
use tokio::sync::Mutex;
use tracing::instrument::WithSubscriber;
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

pub enum ChildProcessMessage {
    Kill,
}

#[napi]
pub struct ChildProcess {
    child: Box<dyn Child + Sync + Send>,
    // tx: Sender<ChildProcessMessage>,
    // rx: Receiver<ChildProcessMessage>,
}

#[napi]
impl ChildProcess {
    pub fn new(child: Box<dyn Child + Sync + Send>) -> Self {
        // let (tx, mut rx) = channel(1);
        //
        // let child = Arc::new(Mutex::new(child));
        //
        // let child_clone = Arc::clone(child);
        //
        // tokio::spawn(async move {
        //     let child = &*child_clone;
        //
        //     let status = child.lock().await.wait().unwrap();
        //
        //     tx.send(status.exit_code()).await
        // });

        Self { child }
    }
    #[napi]
    pub fn kill(&mut self) -> anyhow::Result<()> {
        let mut killer = self.child.clone_killer();
        killer.kill().map_err(anyhow::Error::from)?;
        Ok(())
        // self.tx.send("kill".to_string()).await
    }
    #[napi]
    pub fn is_alive(&mut self) -> anyhow::Result<bool> {
        Ok(self
            .child
            .try_wait()
            .map_err(anyhow::Error::from)?
            .is_none())
    }

    #[napi]
    pub async unsafe fn wait(&mut self) -> napi::Result<u32> {
        // let (tx, mut rx) = channel(1);
        //
        // let child_clone = Arc::clone(&self.child);
        //
        // tokio::spawn(async move {
        //     let child = &*child_clone;
        //
        //     let status = child.lock().await.wait().unwrap();
        //
        //     tx.send(status.exit_code()).await
        // });
        //
        // rx.recv().await
        // self.child.kill()
        // trace!(?command, ?status);
        // Ok(
        // )
        let status = self
            .child
            .wait()
            .map_err(|e| anyhow!("waiting for child: {}", e))?;

        Ok(status.exit_code())
    }

    pub fn stdout(&mut self) -> () {}
}

#[napi]
pub fn run_command(
    command: String,
    command_dir: Option<String>,
    ready_when: Option<String>,
    js_env: Option<HashMap<String, String>>,
) -> napi::Result<ChildProcess> {
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
    let mut stdout = std::io::stdout();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut s = String::new();
        let mut buffer = [0; 8 * 1024];

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            stdout.write_all(&buffer[..n]).unwrap();
            stdout.flush().unwrap();
        }
    });

    Ok(ChildProcess::new(child))

    // let mut ready_when_check = false;
    //
    // while let Ok(n) = reader.read(&mut buffer).await {
    //     if n == 0 {
    //         break;
    //     }
    //
    //     stdout.write_all(&buffer[..n]).await?;
    //     stdout.flush().await?;
    //
    //     if let Some(ready_when) = ready_when.as_ref() {
    //         let buffer = std::str::from_utf8(&buffer[..n]).unwrap_or("");
    //         buffer.contains(ready_when);
    //         ready_when_check = true;
    //         break;
    //     }
    // }
    //
    // if ready_when_check {
    //     return Ok(0);
    // };

    // Wait for the child to complete
    // let status = child.wait()?;
    //
    // trace!(?command, ?status);
    // Ok(status.exit_code())
}
