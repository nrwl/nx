package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.runner.OutputProcessor.splitOutputPerTask
import dev.nx.gradle.util.logger
import java.io.ByteArrayOutputStream
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult

/**
 * Normalizes a Gradle task path by removing the leading colon. Gradle events use paths like
 * `:project:task` but Nx uses `project:task`.
 */
fun normalizeTaskPath(taskPath: String): String = taskPath.trimStart(':')

fun buildListener(
    tasks: Map<String, GradleTask>,
    taskStartTimes: MutableMap<String, Long>,
    taskResults: MutableMap<String, TaskResult>,
    pendingEmit: MutableMap<String, String>,
    outputStream: ByteArrayOutputStream,
    emitForTaskPath: (taskPath: String, output: String) -> Unit
): (ProgressEvent) -> Unit = { event ->
  when (event) {
    is TaskStartEvent -> {
      // Each TaskStartEvent on the listener is a chance to drain pendingEmit. A parked task is
      // safe to ship once its bytes have actually reached our OutputStream — splitOutputPerTask
      // returns an entry for it once Gradle's writer thread has flushed its `> Task :…` header
      // and content. If the section is empty (writer thread hasn't caught up yet), leave the
      // task parked for a later TaskStartEvent or the end-of-build flush.
      if (pendingEmit.isNotEmpty()) {
        val sections = splitOutputPerTask(outputStream.toString("UTF-8"))
        pendingEmit.keys.toList().forEach { parked ->
          val captured = sections[parked]
          if (!captured.isNullOrEmpty()) {
            emitForTaskPath(parked, captured)
          }
        }
      }

      val taskPath = event.descriptor.taskPath
      tasks.entries
          .find { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
          ?.key
          ?.let { nxTaskId ->
            taskStartTimes[nxTaskId] = event.eventTime
            logger.info("🏁 Task start: $nxTaskId $taskPath")
          }
    }

    is TaskFinishEvent -> {
      val taskPath = event.descriptor.taskPath
      val success = getTaskFinishEventSuccess(event, taskPath)
      tasks.entries
          .find { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
          ?.key
          ?.let { nxTaskId ->
            val endTime = event.result.endTime
            val startTime = taskStartTimes[nxTaskId] ?: event.result.startTime
            // Record the result without terminalOutput. terminalOutput is filled in when a later
            // TaskStartEvent fires (drains pendingEmit) or by the end-of-build flush.
            taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
            pendingEmit[taskPath] = nxTaskId
          }
    }
  }
}

fun getTaskFinishEventSuccess(event: TaskFinishEvent, taskPath: String): Boolean {
  return when (event.result) {
    is TaskSuccessResult -> {
      logger.info("✅ Task finished successfully: $taskPath")
      true
    }

    is TaskFailureResult -> {
      logger.warning("❌ Task failed: $taskPath")
      false
    }

    else -> true
  }
}
