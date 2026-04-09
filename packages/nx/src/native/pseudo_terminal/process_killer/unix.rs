use nix::{
    sys::signal::{Signal as NixSignal, kill},
    unistd::Pid,
};
use tracing::debug;

pub struct ProcessKiller {
    pid: i32,
}

impl ProcessKiller {
    pub fn new(pid: i32) -> Self {
        Self { pid }
    }

    pub fn get_pid(&self) -> i32 {
        self.pid
    }

    pub fn kill(&self, signal: Option<&str>) -> anyhow::Result<()> {
        let signal = signal.unwrap_or("SIGINT");
        debug!("Killing process {} with {}", &self.pid, signal);
        let pid = Pid::from_raw(self.pid);
        match kill(
            pid,
            NixSignal::from(Signal::try_from(signal).map_err(|e| anyhow::anyhow!(e))?),
        ) {
            Ok(_) => Ok(()),
            Err(e) => Err(anyhow::anyhow!("Failed to kill process: {}", e)),
        }
    }
}

enum Signal {
    SIGTERM,
    SIGINT,
    SIGKILL,
    SIGHUP,
}

impl TryFrom<&str> for Signal {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "SIGHUP" => Ok(Signal::SIGHUP),
            "SIGINT" => Ok(Signal::SIGINT),
            "SIGKILL" => Ok(Signal::SIGKILL),
            "SIGTERM" => Ok(Signal::SIGTERM),
            _ => Err(format!("Invalid signal: {}", value)),
        }
    }
}

impl From<Signal> for NixSignal {
    fn from(signal: Signal) -> Self {
        match signal {
            Signal::SIGTERM => NixSignal::SIGTERM,
            Signal::SIGINT => NixSignal::SIGINT,
            Signal::SIGKILL => NixSignal::SIGKILL,
            Signal::SIGHUP => NixSignal::SIGHUP,
        }
    }
}
