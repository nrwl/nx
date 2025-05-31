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
    testEndTimes: MutableMap<String, Long>,
): (ProgressEvent) -> Unit {
  return { event ->
    logger.info("event $event")
    when (event) {
      is TaskStartEvent,
      is TaskFinishEvent -> buildListener(tasks, taskStartTimes, taskResults)(event)

      is TestStartEvent -> {
        logger.info("TestStartEvent $event")
        ((event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          tasks.entries
              .find { entry ->
                entry.value.testClassName?.let { className.endsWith(".${it}") || it == className }
                    ?: false
              }
              ?.key
              ?.let { nxTaskId ->
                testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
                logger.info("🏁 Test start at ${event.eventTime}: $nxTaskId $className")
              }
        })
      }

      is TestFinishEvent -> {
        val className = (event.descriptor as? JvmTestOperationDescriptor)?.className
        className?.let {
          tasks.entries
              .find { entry ->
                entry.value.testClassName?.let { className.endsWith(".${it}") || it == className }
                    ?: false
              }
              ?.key
              ?.let { nxTaskId ->
                testEndTimes.compute(nxTaskId) { _, _ -> event.result.endTime }
                when (event.result) {
                  is TestSuccessResult ->
                      logger.info("✅ Test passed at ${event.result.endTime}: $nxTaskId $className")

                  is TestFailureResult -> {
                    testTaskStatus[nxTaskId] = false
                    logger.warning("❌ Test failed: $nxTaskId $className")
                  }

                  is TestSkippedResult -> logger.warning("⚠️ Test skipped: $nxTaskId $className")
                  else -> logger.warning("⚠️ Unknown test result: $nxTaskId $className")
                }
              }
        }
      }
    }
  }
}
