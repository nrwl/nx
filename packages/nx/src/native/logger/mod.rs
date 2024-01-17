use colored::Colorize;
use std::io::IsTerminal;
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::fmt::{format, FmtContext, FormatEvent, FormatFields, FormattedFields};
use tracing_subscriber::registry::LookupSpan;
use tracing_subscriber::EnvFilter;

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
            _ => {
                write!(&mut writer, "\n{} {} ", ">".cyan(), "NX".bold().cyan())?;
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

        if !(matches!(level, Level::TRACE)) && !(matches!(level, Level::DEBUG)) {
            writeln!(&mut writer)?;
        }

        writeln!(writer)
    }
}

/// Enable logging for the native module
/// You can set log levels and different logs by setting the `NX_NATIVE_LOGGING` environment variable
/// Examples:
/// - `NX_NATIVE_LOGGING=trace|warn|debug|error|info` - enable all logs for all crates and modules
/// - `NX_NATIVE_LOGGING=nx=trace` - enable all logs for the `nx` (this) crate
/// - `NX_NATIVE_LOGGING=nx::native::tasks::hashers::hash_project_files=trace` - enable all logs for the `hash_project_files` module
/// - `NX_NATIVE_LOGGING=[{project_name=project}]` - enable logs that contain the project in its span
pub(crate) fn enable_logger() {
    let env_filter =
        EnvFilter::try_from_env("NX_NATIVE_LOGGING").unwrap_or_else(|_| EnvFilter::new("ERROR"));
    _ = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_ansi(std::io::stdout().is_terminal())
        .event_format(NxLogFormatter)
        .try_init()
        .ok();
}
