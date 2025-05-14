package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import kotlin.math.max
import kotlin.math.min
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
      (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
        tasks.entries
            .find { entry -> entry.value.testClassName?.let { className.endsWith(it) } ?: false }
            ?.key
            ?.let { nxTaskId ->
              testStartTimes.compute(nxTaskId) { _, old ->
                min(old ?: event.eventTime, event.eventTime)
              }
            }
      }
    }
    is TestFinishEvent -> {
      (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
        tasks.entries
            .find { entry -> entry.value.testClassName?.let { className.endsWith(it) } ?: false }
            ?.key
            ?.let { nxTaskId ->
              testEndTimes.compute(nxTaskId) { _, old ->
                max(old ?: event.eventTime, event.eventTime)
              }
              when (event.result) {
                is TestSuccessResult -> logger.info("\u2705 Test passed: $nxTaskId $className")
                is TestFailureResult -> {
                  testTaskStatus[nxTaskId] = false
                  logger.warning("\u274C Test failed: $nxTaskId $className")
                }
                is TestSkippedResult ->
                    logger.warning("\u26A0\uFE0F Test skipped: $nxTaskId $className")
                else -> logger.warning("\u26A0\uFE0F Unknown test result: $nxTaskId $className")
              }
            }
      }
    }
  }
}
