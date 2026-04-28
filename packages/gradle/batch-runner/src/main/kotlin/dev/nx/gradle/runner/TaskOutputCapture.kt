package dev.nx.gradle.runner

import java.io.ByteArrayOutputStream
import java.io.OutputStream

/**
 * OutputStream that splits a Gradle build output stream into per-task buffers, keyed by Gradle task
 * path (e.g. `:foo:bar`).
 *
 * Bytes are written through to [downstream] for live display. Internally, bytes are line-buffered
 * and inspected for `> Task :foo:bar` headers — when a header is encountered, the "current task"
 * switches and [onPrevTaskComplete] fires for the previous task with its fully captured output.
 * That signal is what lets the batch runner emit a streamed `NX_RESULT` with full per-task output:
 * by the time the next task's header arrives, all of the previous task's output is captured.
 *
 * The last task in the build never sees a "next header" — call [getOutput] on it after the build
 * finishes to retrieve its captured output and emit it from the caller.
 */
class TaskOutputCapture(
    private val downstream: OutputStream,
    private val onPrevTaskComplete: (prevTaskPath: String, output: String) -> Unit
) : OutputStream() {
  private val lineBuffer = ByteArrayOutputStream()
  private val taskBuffers = mutableMapOf<String, ByteArrayOutputStream>()
  private var currentTask: String? = null

  @Synchronized
  fun getOutput(taskPath: String): String = taskBuffers[taskPath]?.toString("UTF-8") ?: ""

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
      val newTask = match.groupValues[1]
      val oldTask = currentTask
      currentTask = newTask
      taskBuffers.getOrPut(newTask) { ByteArrayOutputStream() }.write(lineBytes)
      if (oldTask != null && oldTask != newTask) {
        val captured = taskBuffers[oldTask]?.toString("UTF-8") ?: ""
        onPrevTaskComplete(oldTask, captured)
      }
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
