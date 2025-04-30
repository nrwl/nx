package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.test.*

fun testListener(
    tasks: Map<String, GradleTask>,
    taskStartTimes: MutableMap<String, Long>,
    taskResults: MutableMap<String, TaskResult>,
    testTaskStatus: MutableMap<String, Boolean>,
    testStartTimes: MutableMap<String, Long>,
    testEndTimes: MutableMap<String, Long>
): (ProgressEvent) -> Unit = { event ->
  when (event) {
    is TaskStartEvent,
    is TaskFinishEvent -> buildListener(tasks, taskStartTimes, taskResults)(event)
    is TestStartEvent -> {
      ((event.descriptor as? JvmTestOperationDescriptor)?.className?.substringAfterLast('.')?.let {
          simpleClassName ->
        tasks.entries
            .find { entry -> entry.value.testClassName?.let { simpleClassName == it } ?: false }
            ?.key
            ?.let { nxTaskId ->
              testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
              logger.info("🏁 Test start at ${event.eventTime}: $nxTaskId $simpleClassName")
            }
      })
    }
    is TestFinishEvent -> {
      ((event.descriptor as? JvmTestOperationDescriptor)?.className?.substringAfterLast('.')?.let {
          simpleClassName ->
        tasks.entries
            .find { entry -> entry.value.testClassName?.let { simpleClassName == it } ?: false }
            ?.key
            ?.let { nxTaskId ->
              testEndTimes.compute(nxTaskId) { _, _ -> event.result.endTime }
              when (event.result) {
                is TestSuccessResult ->
                    logger.info(
                        "\u2705 Test passed at ${event.result.endTime}: $nxTaskId $simpleClassName")
                is TestFailureResult -> {
                  testTaskStatus[nxTaskId] = false
                  logger.warning("\u274C Test failed: $nxTaskId $simpleClassName")
                }

                is TestSkippedResult ->
                    logger.warning("\u26A0\uFE0F Test skipped: $nxTaskId $simpleClassName")

                else ->
                    logger.warning("\u26A0\uFE0F Unknown test result: $nxTaskId $simpleClassName")
              }
            }
      })
    }
  }
}
