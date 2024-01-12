use std::{
    collections::HashMap,
    io::{BufReader, Read, Write},
};

use anyhow::anyhow;
use crossbeam_channel::{bounded, unbounded, Receiver};
use napi::threadsafe_function::ErrorStrategy::{ErrorStrategy, Fatal};
use napi::threadsafe_function::ThreadsafeFunction;
use napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking;
use napi::{Env, JsFunction};
use portable_pty::{ChildKiller, CommandBuilder, NativePtySystem, PtySize, PtySystem};

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
    // pair: portable_pty::PtyPair,
    child_killer: Box<dyn ChildKiller + Sync + Send>,
    message_receiver: Receiver<String>,
    wait_receiver: Receiver<u32>,
}
#[napi]
impl ChildProcess {
    pub fn new(
        child_killer: Box<dyn ChildKiller + Sync + Send>,
        message_receiver: Receiver<String>,
        exit_receiver: Receiver<u32>,
    ) -> Self {
        Self {
            // pair,
            child_killer,
            message_receiver,
            wait_receiver: exit_receiver,
        }
    }
    #[napi]
    pub fn kill(&mut self) -> anyhow::Result<()> {
        self.child_killer.kill().map_err(anyhow::Error::from)?;
        Ok(())
    }
    // #[napi]
    // pub fn is_alive(&mut self) -> anyhow::Result<bool> {
    //     Ok(self
    //         .child_killer
    //         .try_wait()
    //         .map_err(anyhow::Error::from)?
    //         .is_none())
    // }

    #[napi]
    pub fn wait(&mut self, env: Env, callback: JsFunction) -> napi::Result<()> {
        let wait = self.wait_receiver.clone();
        let mut callback_tsfn: ThreadsafeFunction<u32, Fatal> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        std::thread::spawn(move || {
            if let Ok(exit_code) = wait.recv() {
                // println!("sending exit_code to node: {:?}", exit_code);
                callback_tsfn.call(exit_code, NonBlocking);
            }
        });

        Ok(())
    }

    #[napi]
    pub fn on_output(
        &mut self,
        env: Env,
        #[napi(ts_arg_type = "(message: string) => void")] callback: JsFunction,
    ) -> napi::Result<()> {
        let rx = self.message_receiver.clone();

        let mut callback_tsfn: ThreadsafeFunction<String, Fatal> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        callback_tsfn.unref(&env)?;

        std::thread::spawn(move || {
            while let Ok(content) = rx.recv() {
                callback_tsfn.call(content, NonBlocking);
            }
        });

        Ok(())
    }
}

fn get_directory(command_dir: Option<String>) -> anyhow::Result<String> {
    if let Some(command_dir) = command_dir {
        Ok(command_dir)
    } else {
        std::env::current_dir()
            .map(|v| v.to_string_lossy().to_string())
            .map_err(|_| {
                anyhow!("failed to get current directory, please specify command_dir explicitly")
            })
    }
}

#[napi]
pub fn run_command(
    command: String,
    command_dir: Option<String>,
    js_env: Option<HashMap<String, String>>,
    quiet: Option<bool>,
) -> napi::Result<ChildProcess> {
    let command_dir = get_directory(command_dir)?;

    let quiet = quiet.unwrap_or(false);

    let pty_system = NativePtySystem::default();

    let pair = pty_system.openpty(PtySize {
        rows: 73,
        cols: 282,
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

    let (message_tx, message_rx) = unbounded();

    let reader = pair.master.try_clone_reader()?;
    let mut stdout = std::io::stdout();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = [0; 8 * 1024];

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }

            let content = String::from_utf8_lossy(&buffer[..n]);
            message_tx.send(content.to_string()).ok();
            if !quiet {
                stdout.write_all(&buffer[..n]).ok();
                stdout.flush().ok();
            }
        }
    });

    let mut child = pair.slave.spawn_command(cmd)?;
    // Release any handles owned by the slave
    // we don't need it now that we've spawned the child.
    drop(pair.slave);

    let killer = child.clone_killer();
    let (exit_tx, exit_rx) = bounded(1);
    std::thread::spawn(move || {
        let exit = child.wait().unwrap();
        // make sure that master is only dropped after we wait on the child. Otherwise windows does not like it
        drop(pair.master);
        exit_tx.send(exit.exit_code()).ok();
    });

    Ok(ChildProcess::new(killer, message_rx, exit_rx))
}

#[napi]
pub fn nx_fork(
    id: String,
    fork_script: String,
    psuedo_ipc_path: String,
    command_dir: Option<String>,
    js_env: Option<HashMap<String, String>>,
    quiet: bool,
) -> napi::Result<ChildProcess> {
    let child_process = run_command(
        format!("node {} {} {}", fork_script, psuedo_ipc_path, id),
        command_dir,
        js_env,
        Some(quiet),
    )?;

    Ok(child_process)
}
