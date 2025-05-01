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

  fun splitOutputPerTask(globalOutput: String): Map<String, String> {
    val unescapedOutput = globalOutput.replace("\\u003e", ">").replace("\\n", "\n")
    val taskHeaderRegex = Regex("(?=> Task (:[^\\s]+))")
    val sections = unescapedOutput.split(taskHeaderRegex)
    val taskOutputMap = mutableMapOf<String, String>()

    for (section in sections) {
      val lines = section.trim().lines()
      if (lines.isEmpty()) continue
      val header = lines.firstOrNull { it.startsWith("> Task ") }
      if (header != null) {
        val taskMatch = Regex("> Task (:[^\\s]+)").find(header)
        val taskName = taskMatch?.groupValues?.get(1) ?: continue
        taskOutputMap[taskName] = section.trim()
      }
    }
    return taskOutputMap
  }
}
