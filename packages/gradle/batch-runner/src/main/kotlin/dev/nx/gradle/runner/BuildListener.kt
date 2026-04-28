package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
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
    pendingEmit: MutableMap<String, String>
): (ProgressEvent) -> Unit = { event ->
  when (event) {
    is TaskStartEvent -> {
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
            // Record the result without terminalOutput. Per-task stdout is filled in by
            // TaskOutputCapture's onPrevTaskComplete callback (when the next task's header
            // arrives) or by the end-of-build flush. That deferred trigger is what gives us
            // mid-build streaming with full per-task output.
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
