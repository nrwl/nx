package dev.nx.gradle.runner

import java.io.ByteArrayOutputStream
import java.io.OutputStream

/**
 * OutputStream that line-buffers its input and routes bytes into per-Gradle-task buffers as they
 * flow through, keyed by `> Task :foo:bar` headers. Bytes are written through to [downstream] for
 * live display.
 *
 * Lookups via [getOutput] return the captured bytes for a single task — including stripping the
 * trailing scheduling-preamble lines for the *next* task that always end up attributed to the
 * previous task by header-position. Constant amortized cost per byte written, O(own-task size) per
 * lookup; contrast with re-parsing the global stream on each lookup.
 */
class TaskOutputCapture(private val downstream: OutputStream) : OutputStream() {
  private val lineBuffer = ByteArrayOutputStream()
  private val taskBuffers = mutableMapOf<String, ByteArrayOutputStream>()
  private var currentTask: String? = null

  @Synchronized
  fun getOutput(taskPath: String): String {
    val raw = taskBuffers[taskPath]?.toString("UTF-8") ?: return ""
    return OutputProcessor.stripNextTaskPreamble(raw, taskPath)
  }

  @Synchronized
  override fun write(b: Int) {
    downstream.write(b)
    lineBuffer.write(b)
    if (b == NEWLINE) flushLine()
  }

  @Synchronized
  override fun write(buf: ByteArray, off: Int, len: Int) {
    downstream.write(buf, off, len)
    for (i in off until off + len) {
      val byte = buf[i].toInt() and 0xFF
      lineBuffer.write(byte)
      if (byte == NEWLINE) flushLine()
    }
  }

  @Synchronized
  override fun flush() {
    downstream.flush()
  }

  private fun flushLine() {
    val lineBytes = lineBuffer.toByteArray()
    lineBuffer.reset()
    val line = String(lineBytes, Charsets.UTF_8)
    val match = TASK_HEADER.find(line)
    if (match != null) {
      currentTask = match.groupValues[1]
      taskBuffers.getOrPut(currentTask!!) { ByteArrayOutputStream() }.write(lineBytes)
    } else {
      currentTask?.let { task ->
        taskBuffers.getOrPut(task) { ByteArrayOutputStream() }.write(lineBytes)
      }
    }
  }

  companion object {
    private const val NEWLINE = '\n'.code
    private val TASK_HEADER = Regex("^> Task (:[^\\s]+)")
  }
}
