package dev.nx.gradle.runner

import java.io.OutputStream

/**
 * An OutputStream that writes to two destinations simultaneously. Used to capture Gradle output for
 * JSON results while also forwarding it to stderr for real-time terminal display.
 */
class TeeOutputStream(private val primary: OutputStream, private val secondary: OutputStream) :
    OutputStream() {

  override fun write(b: Int) {
    primary.write(b)
    secondary.write(b)
    secondary.flush()
  }

  override fun write(b: ByteArray) {
    primary.write(b)
    secondary.write(b)
    secondary.flush()
  }

  override fun write(b: ByteArray, off: Int, len: Int) {
    primary.write(b, off, len)
    secondary.write(b, off, len)
    secondary.flush()
  }

  override fun flush() {
    primary.flush()
    secondary.flush()
  }

  override fun close() {
    primary.close()
    // Don't close secondary (e.g. System.err) — we don't own it
  }
}
