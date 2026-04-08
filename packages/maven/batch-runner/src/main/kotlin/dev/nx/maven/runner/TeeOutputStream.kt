package dev.nx.maven.runner

import java.io.OutputStream

/**
 * OutputStream that writes to both a capture buffer and streams to stdout in real-time.
 * (stdout is inherited by parent process, stderr is used for result JSON lines)
 */
class TeeOutputStream(
  private val capture: OutputStream,
  private val stream: OutputStream = System.out
) : OutputStream() {
  override fun write(b: Int) {
    capture.write(b)
    stream.write(b)
    stream.flush()
  }

  override fun write(b: ByteArray) {
    capture.write(b)
    stream.write(b)
    stream.flush()
  }

  override fun write(b: ByteArray, off: Int, len: Int) {
    capture.write(b, off, len)
    stream.write(b, off, len)
    stream.flush()
  }

  override fun flush() {
    capture.flush()
    stream.flush()
  }

  override fun close() {
    capture.close()
    // Don't close stream (System.out)
  }
}
