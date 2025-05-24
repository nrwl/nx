package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult

fun buildListener(
    tasks: Map<String, GradleTask>,
    taskStartTimes: MutableMap<String, Long>,
    taskResults: MutableMap<String, TaskResult>
): (ProgressEvent) -> Unit = { event ->
  when (event) {
    is TaskStartEvent -> {
      tasks.entries
          .find { it.value.taskName == event.descriptor.taskPath }
          ?.key
          ?.let { nxTaskId -> taskStartTimes[nxTaskId] = event.eventTime }
    }

    is TaskFinishEvent -> {
      val taskPath = event.descriptor.taskPath
      val success = getTaskFinishEventSucces(event, taskPath)
      tasks.entries
          .find { it.value.taskName == taskPath }
          ?.key
          ?.let { nxTaskId ->
            val endTime = event.result.endTime
            val startTime = taskStartTimes[nxTaskId] ?: event.result.startTime
            taskResults[nxTaskId] = TaskResult(success, startTime, endTime, "")
          }
    }
  }
}

fun getTaskFinishEventSucces(event: TaskFinishEvent, taskPath: String): Boolean {
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
