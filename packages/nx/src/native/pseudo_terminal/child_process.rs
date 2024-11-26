use crossbeam_channel::Receiver;
use napi::{
    threadsafe_function::{
        ErrorStrategy::Fatal, ThreadsafeFunction, ThreadsafeFunctionCallMode::NonBlocking,
    },
    Env, JsFunction,
};
use portable_pty::ChildKiller;

pub enum ChildProcessMessage {
    Kill,
}

#[napi]
pub struct ChildProcess {
    process_killer: Box<dyn ChildKiller + Sync + Send>,
    message_receiver: Receiver<String>,
    pub(crate) wait_receiver: Receiver<String>,
}
#[napi]
impl ChildProcess {
    pub fn new(
        process_killer: Box<dyn ChildKiller + Sync + Send>,
        message_receiver: Receiver<String>,
        exit_receiver: Receiver<String>,
    ) -> Self {
        Self {
            process_killer,
            message_receiver,
            wait_receiver: exit_receiver,
        }
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

        std::thread::spawn(move || {
            while let Ok(content) = rx.recv() {
                // windows will add `ESC[6n` to the beginning of the output,
                // we dont want to store this ANSI code in cache, because replays will cause issues
                // remove it before sending it to js
                #[cfg(windows)]
                let content = content.replace("\x1B[6n", "");

                callback_tsfn.call(content, NonBlocking);
            }
        });

        Ok(())
    }
}
