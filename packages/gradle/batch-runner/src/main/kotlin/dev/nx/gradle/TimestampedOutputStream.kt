package dev.nx.gradle

import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.time.Instant

class TimestampedOutputStream(private val delegate: OutputStream) : OutputStream() {
    private val buffer = StringBuilder()

    override fun write(b: Int) {
        val ch = b.toChar()
        buffer.append(ch)
        if (ch == '\n') {
            flushBuffer()
        }
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        val str = String(b, off, len, StandardCharsets.UTF_8)
        for (c in str) {
            write(c.code)
        }
    }

    private fun flushBuffer() {
        val timestamp = Instant.now().toEpochMilli()
        val lineWithTimestamp = "[$timestamp] ${buffer.toString()}"
        delegate.write(lineWithTimestamp.toByteArray(StandardCharsets.UTF_8))
        buffer.setLength(0)
    }

    override fun flush() {
        if (buffer.isNotEmpty()) {
            flushBuffer()
        }
        delegate.flush()
    }

    override fun close() {
        flush()
        delegate.close()
    }
}
