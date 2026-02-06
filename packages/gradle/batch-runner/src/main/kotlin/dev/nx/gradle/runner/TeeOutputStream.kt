package dev.nx.gradle.runner

import java.io.OutputStream
import java.io.PrintStream

/**
 * Output stream that:
 * 1. Forwards all output to a delegate stream (for real-time terminal display)
 * 2. Calls a line callback for each complete line (for per-task buffering)
 *
 * This enables streaming Gradle output to the terminal in real-time while also tracking output on a
 * per-task basis for result attribution.
 */
class TeeOutputStream(private val delegate: PrintStream, private val onLine: (String) -> Unit) :
    OutputStream() {

  private val lineBuffer = StringBuilder()

  override fun write(b: Int) {
    delegate.write(b)

    val char = b.toChar()
    if (char == '\n') {
      onLine(lineBuffer.toString())
      lineBuffer.clear()
    } else if (char != '\r') {
      // Skip carriage returns to normalize line endings
      lineBuffer.append(char)
    }
  }

  override fun write(b: ByteArray, off: Int, len: Int) {
    delegate.write(b, off, len)

    val str = String(b, off, len, Charsets.UTF_8)
    for (char in str) {
      if (char == '\n') {
        onLine(lineBuffer.toString())
        lineBuffer.clear()
      } else if (char != '\r') {
        lineBuffer.append(char)
      }
    }
  }

  override fun flush() {
    delegate.flush()
  }

  override fun close() {
    // Flush any remaining content in the buffer
    if (lineBuffer.isNotEmpty()) {
      onLine(lineBuffer.toString())
      lineBuffer.clear()
    }
    delegate.flush()
    // Note: We don't close the delegate (System.out) as it's shared
  }
}
