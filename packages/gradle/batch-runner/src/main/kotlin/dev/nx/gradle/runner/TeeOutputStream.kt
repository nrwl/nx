package dev.nx.gradle.runner

import java.io.OutputStream

/**
 * Output stream that writes to both a delegate stream and a capture stream. Used for forwarding
 * Gradle output to the terminal in real-time while simultaneously capturing it for result
 * attribution.
 */
class TeeOutputStream(private val delegate: OutputStream, private val capture: OutputStream) :
    OutputStream() {

  override fun write(b: Int) {
    delegate.write(b)
    capture.write(b)
  }

  override fun write(b: ByteArray, off: Int, len: Int) {
    delegate.write(b, off, len)
    capture.write(b, off, len)
  }

  override fun flush() {
    delegate.flush()
    capture.flush()
  }

  override fun close() {
    delegate.flush()
    capture.flush()
    // Note: We don't close the delegate (System.out) as it's shared.
    // The capture stream is owned by the caller.
  }
}
