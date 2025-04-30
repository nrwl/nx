package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
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

  fun finalizeTaskResults(
      tasks: Map<String, GradleTask>,
      taskResults: MutableMap<String, TaskResult>,
      globalOutput: String,
      errorStream: ByteArrayOutputStream,
      globalStart: Long,
      globalEnd: Long
  ): Map<String, TaskResult> {
    val perTaskOutput = splitOutputPerTask(globalOutput)

    tasks.forEach { (taskId, taskConfig) ->
      val baseOutput = perTaskOutput[taskConfig.taskName] ?: ""
      val existingResult = taskResults[taskId]

      val outputWithErrors =
          if (existingResult?.success == false) {
            baseOutput + "\n" + errorStream.toString()
          } else {
            baseOutput
          }

      val finalOutput = outputWithErrors.ifBlank { globalOutput }

      taskResults[taskId] =
          existingResult?.copy(terminalOutput = finalOutput)
              ?: TaskResult(
                  success = false,
                  startTime = globalStart,
                  endTime = globalEnd,
                  terminalOutput = finalOutput)
    }

    return taskResults
  }

  private fun splitOutputPerTask(globalOutput: String): Map<String, String> {
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
