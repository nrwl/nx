#[derive(Clone)]
pub struct TuiCliArgs {
    pub targets: Vec<String>,
    pub tui_auto_exit: Option<AutoExit>,
}

#[derive(Clone)]
pub enum AutoExit {
    Boolean(bool),
    Integer(u32),
}

impl AutoExit {
    pub const DEFAULT_COUNTDOWN_SECONDS: u32 = 3;

    // Return whether the TUI should exit automatically
    pub fn should_exit_automatically(&self) -> bool {
        match self {
            // false means don't auto-exit
            AutoExit::Boolean(false) => false,
            // true means exit immediately (no countdown)
            AutoExit::Boolean(true) => true,
            // A number means exit after countdown
            AutoExit::Integer(_) => true,
        }
    }

    // Get countdown seconds (if countdown is enabled)
    pub fn countdown_seconds(&self) -> Option<u32> {
        match self {
            // false means no auto-exit, so no countdown
            AutoExit::Boolean(false) => None,
            // true means exit immediately, so no countdown
            AutoExit::Boolean(true) => None,
            // A number means show countdown for that many seconds
            AutoExit::Integer(seconds) => Some(*seconds),
        }
    }
}

pub struct TuiConfig {
    pub auto_exit: AutoExit,
}

impl TuiConfig {
    /// Creates a new TuiConfig from nx.json config properties and CLI args
    pub fn new(auto_exit: Option<AutoExit>, cli_args: &TuiCliArgs) -> Self {
        // Default to 3-second countdown if nothing is specified
        let final_auto_exit = match auto_exit {
            Some(config) => config,
            None => AutoExit::Integer(AutoExit::DEFAULT_COUNTDOWN_SECONDS),
        };
        // CLI args take precedence over programmatic config
        let final_auto_exit = match &cli_args.tui_auto_exit {
            Some(cli_value) => cli_value.clone(),
            None => final_auto_exit,
        };
        Self {
            auto_exit: final_auto_exit,
        }
    }
}
