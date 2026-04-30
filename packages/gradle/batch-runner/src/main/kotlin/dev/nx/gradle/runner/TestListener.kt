package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.util.formatMillis
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.test.*

fun testListener(
    tasks: Map<String, GradleTask>,
    testTaskStatus: MutableMap<String, Boolean>,
    testStartTimes: MutableMap<String, Long>,
    testEndTimes: MutableMap<String, Long>,
    onTestTaskComplete: (nxTaskId: String) -> Unit = {},
): (ProgressEvent) -> Unit {
  val classNameToTaskId: Map<String, String> =
      tasks.entries.mapNotNull { (id, task) -> task.testClassName?.let { it to id } }.toMap()
  val taskPathToTaskIds: Map<String, List<String>> =
      tasks.entries.groupBy({ normalizeTaskPath(it.value.taskName) }, { it.key })

  // The Nx gradle plugin records testClassName as the simple class name (e.g. "MyTest"),
  // but Gradle's JvmTestOperationDescriptor.className is the FQN (e.g. "com.foo.MyTest").
  // Look up by FQN first, fall back to simple name so events match either way.
  fun resolveNxTaskId(gradleClassName: String): String? =
      classNameToTaskId[gradleClassName]
          ?: classNameToTaskId[gradleClassName.substringAfterLast('.')]

  return { event ->
    when (event) {
      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        val success = getTaskFinishEventSuccess(event, taskPath)

        taskPathToTaskIds[normalizeTaskPath(taskPath)]?.forEach { nxTaskId ->
          testTaskStatus.computeIfAbsent(nxTaskId) { success }
          testEndTimes.computeIfAbsent(nxTaskId) { event.result.endTime }
          // Safety net: tasks that never fired a class-level TestFinishEvent
          // (e.g. compile failure) emit here. ResultEmitter dedupes.
          onTestTaskComplete(nxTaskId)
        }
      }

      is TestStartEvent -> {
        (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          resolveNxTaskId(className)?.let { nxTaskId ->
            testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
            logger.info("🏁 Test start: $nxTaskId $className")
          }
        }
      }

      is TestFinishEvent -> {
        (event.descriptor as? JvmTestOperationDescriptor)?.let { descriptor ->
          val className = descriptor.className ?: return@let
          val nxTaskId = resolveNxTaskId(className) ?: return@let

          testEndTimes[nxTaskId] = event.result.endTime

          val failed = event.result is TestFailureResult
          if (failed) {
            // Failure is sticky; a later passing method can't mask it.
            testTaskStatus[nxTaskId] = false
          } else {
            testTaskStatus.putIfAbsent(nxTaskId, true)
          }

          val name = descriptor.methodName ?: className
          when (event.result) {
            is TestSuccessResult ->
                logger.info(
                    "✅ Test passed at ${formatMillis(event.result.endTime)}: $nxTaskId $name")
            is TestFailureResult -> logger.warning("❌ Test failed: $nxTaskId $name")
            is TestSkippedResult -> logger.warning("⚠️ Test skipped: $nxTaskId $name")
            else -> logger.warning("⚠️ Unknown test result: $nxTaskId $name")
          }

          if (descriptor.methodName == null) {
            // Class-level event is the authoritative Nx-task milestone; emit now.
            testTaskStatus[nxTaskId] = !failed
            onTestTaskComplete(nxTaskId)
          }
        }
      }
    }
  }
}
