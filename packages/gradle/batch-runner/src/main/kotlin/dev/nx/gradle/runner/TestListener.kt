package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.util.formatMillis
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.test.*

private fun findNxTaskIdByClassName(className: String?, tasks: Map<String, GradleTask>): String? {
  return className?.let {
    val simpleClassName = it.substringAfterLast('.')
    tasks.entries
        .find { (_, v) -> v.testClassName == simpleClassName || v.testClassName == className }
        ?.key
  }
}

fun testListener(
    tasks: Map<String, GradleTask>,
    testTaskStatus: MutableMap<String, Boolean>,
    testStartTimes: MutableMap<String, Long>,
    testEndTimes: MutableMap<String, Long>,
): (ProgressEvent) -> Unit {
  return { event ->
    when (event) {
      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        val success = getTaskFinishEventSuccess(event, taskPath)

        tasks.entries
            .filter {
              it.value.taskName == taskPath
            } // Filters the entries to keep only matching ones
            .map { it.key }
            .forEach { nxTaskId -> // Iterate over the filtered entries
              testTaskStatus.computeIfAbsent(nxTaskId) { success }
              testEndTimes.computeIfAbsent(nxTaskId) { event.result.endTime }
            }
      }

      is TestStartEvent -> {
        val descriptor = event.descriptor as? JvmTestOperationDescriptor
        val nxTaskId = findNxTaskIdByClassName(descriptor?.className, tasks)

        nxTaskId?.let {
          testStartTimes.computeIfAbsent(it) { event.eventTime }
          logger.info("🏁 Test start: $it ${descriptor?.className}")
        }
      }

      is TestFinishEvent -> {
        val descriptor = event.descriptor as? JvmTestOperationDescriptor
        val nxTaskId = findNxTaskIdByClassName(descriptor?.className, tasks)

        nxTaskId?.let {
          testEndTimes[it] = event.result.endTime
          val name = descriptor?.className ?: "unknown"

          when (event.result) {
            is TestSuccessResult -> {
              testTaskStatus[it] = true
              logger.info("✅ Test passed at ${formatMillis(event.result.endTime)}: $it $name")
            }

            is TestFailureResult -> {
              testTaskStatus[it] = false
              logger.warning("❌ Test failed: $it $name")
            }

            is TestSkippedResult -> {
              testTaskStatus[it] = true
              logger.warning("⚠️ Test skipped: $it $name")
            }

            else -> {
              testTaskStatus[it] = true
              logger.warning("⚠️ Unknown test result: $it $name")
            }
          }
        }
      }
    }
  }
}
