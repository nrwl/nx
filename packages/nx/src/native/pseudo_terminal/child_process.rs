use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};
use crossbeam_channel::Sender;
use crossbeam_channel::{bounded, Receiver};
use napi::bindgen_prelude::External;
use napi::{
  threadsafe_function::{
    ErrorStrategy::Fatal, ThreadsafeFunction, ThreadsafeFunctionCallMode::NonBlocking,
  },
  Env, JsFunction,
};
use portable_pty::ChildKiller;
use std::io::Write;
use std::sync::{Arc, Mutex, RwLock};
use std::thread::spawn;
use tracing::{debug, warn};
use vt100_ctt::Parser;

pub enum ChildProcessMessage {
    Kill,
}

#[napi]
pub struct ChildProcess {
    parser: Arc<RwLock<Parser>>,
    process_killer: Box<dyn ChildKiller + Sync + Send>,
    message_receiver: Receiver<String>,
    pub(crate) wait_receiver: Receiver<String>,
    thread_handles: Vec<Sender<()>>,
    writer_arc: Arc<Mutex<Box<dyn Write + Send>>>,
}
#[napi]
impl ChildProcess {
    pub fn new(
        parser: Arc<RwLock<Parser>>,
        writer_arc: Arc<Mutex<Box<dyn Write + Send>>>,
        process_killer: Box<dyn ChildKiller + Sync + Send>,
        message_receiver: Receiver<String>,
        exit_receiver: Receiver<String>,
    ) -> Self {
        Self {
            parser,
            writer_arc,
            process_killer,
            message_receiver,
            wait_receiver: exit_receiver,
            thread_handles: vec![],
        }
    }

    #[napi]
    pub fn get_parser_and_writer(&mut self) -> External<(ParserArc, WriterArc)> {
        External::new((self.parser.clone(), self.writer_arc.clone()))
    }

    #[napi]
    pub fn kill(&mut self) -> anyhow::Result<()> {
        self.process_killer.kill().map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn on_exit(
        &mut self,
        #[napi(ts_arg_type = "(message: string) => void")] callback: JsFunction,
    ) -> napi::Result<()> {
        let wait = self.wait_receiver.clone();
        let callback_tsfn: ThreadsafeFunction<String, Fatal> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        std::thread::spawn(move || {
            // we will only get one exit_code here, so we dont need to do a while loop
            if let Ok(exit_code) = wait.recv() {
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

        let (kill_tx, kill_rx) = bounded::<()>(1);

        std::thread::spawn(move || {
            loop {
                if kill_rx.try_recv().is_ok() {
                    break;
                }

                if let Ok(content) = rx.try_recv() {
                    // windows will add `ESC[6n` to the beginning of the output,
                    // we dont want to store this ANSI code in cache, because replays will cause issues
                    // remove it before sending it to js
                    #[cfg(windows)]
                    let content = content.replace("\x1B[6n", "");
                    callback_tsfn.call(content, NonBlocking);
                }
            }
        });

        self.thread_handles.push(kill_tx);

        Ok(())
    }

    #[napi]
    pub fn cleanup(&mut self) {
        let handles = std::mem::take(&mut self.thread_handles);
        for handle in handles {
            if let Err(e) = handle.send(()) {
                warn!(error = ?e, "Failed to send kill signal to thread");
            }
        }
    }
}

impl Drop for ChildProcess {
    fn drop(&mut self) {
        self.cleanup();
    }
}