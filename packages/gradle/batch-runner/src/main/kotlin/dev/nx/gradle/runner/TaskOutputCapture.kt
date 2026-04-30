package dev.nx.gradle.runner

import java.io.ByteArrayOutputStream
import java.io.OutputStream

/**
 * Slices a Gradle build's stdout (and optionally stderr) into per-task buffers as bytes flow.
 *
 * The capture itself acts as Gradle's standard-output sink — it line-buffers, detects `> Task
 * :foo:bar` headers, switches `currentTask`, and routes subsequent bytes into
 * `taskBuffers[currentTask]`. Use [errorSink] to get an `OutputStream` for stderr that *attaches*
 * to whichever task `currentTask` was last set to (no header detection of its own); stderr bytes
 * therefore end up in the same per-task buffer as that task's stdout.
 *
 * [getOutput] returns the captured bytes for a single task with the trailing scheduling-preamble
 * for the next task stripped.
 */
class TaskOutputCapture(private val downstream: OutputStream) : OutputStream() {
  private val lineBuffer = ByteArrayOutputStream()
  private val taskBuffers = mutableMapOf<String, ByteArrayOutputStream>()
  private var currentTask: String? = null

  @Synchronized
  fun getOutput(taskPath: String): String {
    val raw = taskBuffers[taskPath]?.toString("UTF-8") ?: return ""
    return stripNextTaskPreamble(raw, taskPath)
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

  /**
   * Returns an `OutputStream` for stderr that shares this capture's `currentTask` and per-task
   * buffers. Stderr writes never update `currentTask` (no header detection); they're appended to
   * whichever task's stdout header was last seen, so a task's stderr ends up in the same buffer as
   * its stdout.
   */
  fun errorSink(): OutputStream = ErrorSink()

  private inner class ErrorSink : OutputStream() {
    private val errLineBuffer = ByteArrayOutputStream()

    override fun write(b: Int) {
      synchronized(this@TaskOutputCapture) {
        downstream.write(b)
        errLineBuffer.write(b)
        if (b == NEWLINE) flushErrLine()
      }
    }

    override fun write(buf: ByteArray, off: Int, len: Int) {
      synchronized(this@TaskOutputCapture) {
        downstream.write(buf, off, len)
        for (i in off until off + len) {
          val byte = buf[i].toInt() and 0xFF
          errLineBuffer.write(byte)
          if (byte == NEWLINE) flushErrLine()
        }
      }
    }

    override fun flush() {
      synchronized(this@TaskOutputCapture) { downstream.flush() }
    }

    private fun flushErrLine() {
      val lineBytes = errLineBuffer.toByteArray()
      errLineBuffer.reset()
      currentTask?.let { task ->
        taskBuffers.getOrPut(task) { ByteArrayOutputStream() }.write(lineBytes)
      }
    }
  }

  companion object {
    private const val NEWLINE = '\n'.code
    private val TASK_HEADER = Regex("^> Task (:[^\\s]+)")
    private val GRADLE_TASK_PATH = Regex(""":[a-zA-Z][\w\-]*(?::[a-zA-Z][\w\-]*)+""")

    /**
     * Strips trailing lines that reference a Gradle task path other than [currentTaskPath]. Gradle
     * prints scheduling preamble for the next task before its `> Task :…` header arrives in the
     * stream, so header-position attribution leaks those lines into the previous section; this
     * removes them. Stops when a line either references [currentTaskPath] or has no task-path
     * reference at all.
     */
    internal fun stripNextTaskPreamble(captured: String, currentTaskPath: String): String {
      if (captured.isEmpty()) return captured
      val lines = captured.split('\n').toMutableList()
      while (lines.isNotEmpty()) {
        val last = lines.last()
        if (last.isBlank()) {
          lines.removeAt(lines.lastIndex)
          continue
        }
        val refs = GRADLE_TASK_PATH.findAll(last).map { it.value }.toList()
        if (refs.isEmpty()) break
        if (refs.any { it == currentTaskPath }) break
        lines.removeAt(lines.lastIndex)
      }
      return lines.joinToString("\n")
    }
  }
}
