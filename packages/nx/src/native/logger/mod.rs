pub mod console;

use colored::Colorize;
use std::env;
use std::fs::create_dir_all;
use std::io::IsTerminal;
use tracing::{Event, Level, Subscriber};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::{FmtContext, FormatEvent, FormatFields, FormattedFields, format};
use tracing_subscriber::prelude::*;
use tracing_subscriber::registry::LookupSpan;
use tracing_subscriber::{EnvFilter, Layer};
use tui_logger::TuiTracingSubscriberLayer;

struct NxLogFormatter;
impl<S, N> FormatEvent<S, N> for NxLogFormatter
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: format::Writer<'_>,
        event: &Event<'_>,
    ) -> std::fmt::Result {
        // Format values from the event's's metadata:
        let metadata = event.metadata();
        let level = *metadata.level();

        match level {
            Level::TRACE => {
                write!(
                    &mut writer,
                    "{} {}: ",
                    format!("{}", metadata.level()).bold().red(),
                    metadata.target()
                )?;
            }
            Level::DEBUG => {
                write!(
                    &mut writer,
                    "{} {}: ",
                    format!("{}", metadata.level()).bold().bright_blue(),
                    metadata.target()
                )?;
            }

            Level::WARN => {
                write!(&mut writer, "\n{} {} ", ">".yellow(), "NX".bold().yellow())?;
            }
            Level::INFO => {
                // Match TypeScript logger format: inverse cyan "NX" prefix
                write!(&mut writer, "\n{} ", " NX ".on_cyan().black().bold())?;
            }
            Level::ERROR => {
                // Match TypeScript logger format: inverse red "ERROR" prefix
                write!(&mut writer, "\n{} ", " ERROR ".on_red().white().bold())?;
            }
        }

        // Format all the spans in the event's span context.
        if let Some(scope) = ctx.event_scope() {
            for span in scope.from_root() {
                write!(writer, "{}", span.name())?;

                // `FormattedFields` is a formatted representation of the span's
                // fields, which is stored in its extensions by the `fmt` layer's
                // `new_span` method. The fields will have been formatted
                // by the same field formatter that's provided to the event
                // formatter in the `FmtContext`.
                let ext = span.extensions();
                let fields = &ext
                    .get::<FormattedFields<N>>()
                    .expect("will never be `None`");

                // Skip formatting the fields if the span had no fields.
                if !fields.is_empty() {
                    write!(writer, "{{{}}}", fields.bold())?;
                }
                write!(writer, ": ")?;
            }
        }

        // Write fields on the event
        ctx.field_format().format_fields(writer.by_ref(), event)?;

        if matches!(level, Level::INFO | Level::ERROR | Level::WARN) {
            writeln!(&mut writer)?;
        }

        writeln!(writer)
    }
}

/// Enable logging for the native module
/// By default, info level logs are shown. You can change log levels by setting the `NX_NATIVE_LOGGING` environment variable
/// Examples:
/// - `NX_NATIVE_LOGGING=trace|warn|debug|error|info` - enable all logs for all crates and modules
/// - `NX_NATIVE_LOGGING=off` - disable all logging
/// - `NX_NATIVE_LOGGING=nx=trace` - enable all logs for the `nx` (this) crate
/// - `NX_NATIVE_LOGGING=nx::native::tasks::hashers::hash_project_files=trace` - enable all logs for the `hash_project_files` module
/// - `NX_NATIVE_LOGGING=[{project_name=project}]` - enable logs that contain the project in its span
/// NX_NATIVE_FILE_LOGGING acts the same but logs to .nx/workspace-data/nx.log instead of stdout
///
/// Runs once when the native module is loaded, so nothing else has to call it.
#[module_init]
fn enable_logger() {
    initialize_logger();
}

fn initialize_logger() {
    let stdout_layer = tracing_subscriber::fmt::layer()
        .with_ansi(std::io::stdout().is_terminal())
        .with_writer(std::io::stdout)
        .event_format(NxLogFormatter)
        .with_filter(
            EnvFilter::try_from_env("NX_NATIVE_LOGGING")
                .unwrap_or_else(|_| EnvFilter::new("nx::native=info")),
        );

    // The task runner cannot use the TUI without a terminal on stderr,
    // unless its explicit capability-check override is enabled. Avoid
    // formatting and buffering trace events for a UI that cannot be shown.
    let tui_layer = tui_logging_layer(
        std::io::stderr().is_terminal(),
        env::var("NX_TUI_SKIP_CAPABILITY_CHECK").ok().as_deref(),
    );
    let registry = tracing_subscriber::registry()
        .with(stdout_layer)
        .with(tui_layer);
    tui_logger::init_logger(tui_logger::LevelFilter::Trace).ok();

    if env::var("NX_NATIVE_FILE_LOGGING").is_err() {
        // File logging is not enabled
        registry.try_init().ok();
        return;
    }

    let log_dir = ".nx/workspace-data";

    if let Err(e) = create_dir_all(log_dir) {
        // Could not create the directory, so we will not log to file
        println!(
            "Logging to a file was not enabled because Nx could not create the {} directory for logging. Error: {}",
            log_dir, e
        );
        registry.try_init().ok();
        return;
    };

    let file_appender: RollingFileAppender =
        RollingFileAppender::new(Rotation::NEVER, log_dir, "nx.log");
    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(file_appender)
        .event_format(NxLogFormatter)
        .with_ansi(false)
        .with_filter(
            EnvFilter::try_from_env("NX_NATIVE_FILE_LOGGING")
                .unwrap_or_else(|_| EnvFilter::new("ERROR")),
        );

    registry.with(file_layer).try_init().ok();
}

fn tui_logging_layer(
    stderr_is_terminal: bool,
    skip_capability_check: Option<&str>,
) -> Option<TuiTracingSubscriberLayer> {
    (stderr_is_terminal || skip_capability_check == Some("true"))
        .then_some(TuiTracingSubscriberLayer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_invisible_tui_traces_but_preserves_requested_logging() {
        fn trace_enabled(terminal: bool, override_value: Option<&str>, console: &str) -> bool {
            let subscriber = tracing_subscriber::registry()
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_writer(std::io::sink)
                        .with_filter(EnvFilter::new(console)),
                )
                .with(tui_logging_layer(terminal, override_value));
            tracing::subscriber::with_default(subscriber, || tracing::enabled!(Level::TRACE))
        }
        assert!(!trace_enabled(false, None, "info"));
        assert!(!trace_enabled(false, Some("false"), "info"));
        assert!(trace_enabled(true, None, "info"));
        assert!(trace_enabled(false, Some("true"), "info"));
        // Console/file subscribers keep their own filters: explicitly
        // requesting trace still works when the TUI sink is absent.
        assert!(trace_enabled(false, None, "trace"));
    }
}
