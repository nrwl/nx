package dev.nx.gradle.runner

import java.io.ByteArrayOutputStream

object OutputProcessor {
  fun buildTerminalOutput(stdOut: ByteArrayOutputStream, stdErr: ByteArrayOutputStream): String {
    val output = stdOut.toString("UTF-8")
    val errorOutput = stdErr.toString("UTF-8")
    return buildString {
      if (output.isNotBlank()) append(output).append("\n")
      if (errorOutput.isNotBlank()) append(errorOutput)
    }
  }

  /**
   * Splits a captured Gradle build output by `> Task :foo:bar` headers, keyed by Gradle task path.
   * Trailing lines that reference any task other than the current section's are stripped — Gradle
   * prints scheduling preamble for the next task before its `> Task :…` header arrives in the
   * stream, so header-position attribution would otherwise leak it into the previous section.
   */
  fun splitOutputPerTask(globalOutput: String): Map<String, String> {
    val unescapedOutput = globalOutput.replace("\\u003e", ">").replace("\\n", "\n")
    val taskHeaderRegex = Regex("(?=> Task (:[^\\s]+))")
    val sections = unescapedOutput.split(taskHeaderRegex)
    val taskOutputMap = mutableMapOf<String, String>()

    for (section in sections) {
      val trimmedSection = section.trim()
      if (trimmedSection.isEmpty()) continue
      val header =
          trimmedSection.lineSequence().firstOrNull { it.startsWith("> Task ") } ?: continue
      val taskName = TASK_HEADER.find(header)?.groupValues?.get(1) ?: continue
      val cleaned = stripNextTaskPreamble(trimmedSection, taskName)
      taskOutputMap[taskName] = taskOutputMap[taskName]?.let { "$it\n$cleaned" } ?: cleaned
    }
    return taskOutputMap
  }

  private val TASK_HEADER = Regex("> Task (:[^\\s]+)")
  private val GRADLE_TASK_PATH = Regex(""":[a-zA-Z][\w\-]*(?::[a-zA-Z][\w\-]*)+""")

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
