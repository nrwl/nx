package dev.nx.gradle.util

import java.text.SimpleDateFormat
import java.util.*
import java.util.logging.ConsoleHandler // Or your preferred handler
import java.util.logging.Formatter
import java.util.logging.Level
import java.util.logging.LogRecord
import java.util.logging.Logger

/**
 * A custom Formatter for java.util.logging that outputs logs in a single line. Format: [LEVEL]:
 * Message
 */
class SingleLineFormatter : Formatter() {
  override fun format(record: LogRecord): String {
    // Get the log level and the message
    val level = record.level.name
    val message = formatMessage(record)

    // Return the formatted string in a single line
    return "${formatMillis(System.currentTimeMillis())} [$level]: $message\n"
  }
}

// Your existing logger setup, modified to use the custom formatter
val logger: Logger = Logger.getLogger("NxBatchRunner")

fun configureSingleLineLogger(quiet: Boolean) {
  // Get the root logger
  val rootLogger = Logger.getLogger("") // The empty string gets the root logger

  // Remove all handlers from the root logger first
  rootLogger.handlers.forEach { handler -> rootLogger.removeHandler(handler) }

  // Now, configure your specific logger and its handler
  // Ensure this logger does NOT use parent handlers
  logger.useParentHandlers = false

  // Remove any existing handlers from your specific logger (if any were added before)
  logger.handlers.forEach { handler -> logger.removeHandler(handler) }

  val consoleHandler = ConsoleHandler()
  consoleHandler.formatter = SingleLineFormatter()

  // Add the configured handler to your specific logger
  logger.addHandler(consoleHandler)

  // Set levels
  if (quiet) {
    logger.level = Level.OFF // Turn off your specific logger
    consoleHandler.level = Level.OFF // Turn off its handler
    rootLogger.level = Level.OFF // Ensure root logger is also off (or a high level)
  } else {
    logger.level = Level.INFO
    consoleHandler.level = Level.INFO // Ensure handler is on
    rootLogger.level = Level.INFO // Ensure root logger passes INFO and above
  }
}

fun formatMillis(millis: Long): String {
  val sdf = SimpleDateFormat("HH:mm:ss.SSS")
  sdf.timeZone = TimeZone.getTimeZone("UTC") // so it doesn't apply your local timezone offset
  return sdf.format(Date(millis))
}
