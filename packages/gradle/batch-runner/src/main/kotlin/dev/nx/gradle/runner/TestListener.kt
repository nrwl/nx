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
  return { event ->
    when (event) {
      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        val success = getTaskFinishEventSuccess(event, taskPath)

        tasks.entries
            .filter { normalizeTaskPath(it.value.taskName) == normalizeTaskPath(taskPath) }
            .map { it.key }
            .forEach { nxTaskId ->
              testTaskStatus.computeIfAbsent(nxTaskId) { success }
              testEndTimes.computeIfAbsent(nxTaskId) { event.result.endTime }
              // Safety net: if no class-level TestFinishEvent fired for this Nx task
              // (e.g. compile failure skipped the tests), emit it now. The emitter
              // dedupes, so tasks already streamed at class level are skipped.
              onTestTaskComplete(nxTaskId)
            }
      }

      is TestStartEvent -> {
        val descriptor = event.descriptor as? JvmTestOperationDescriptor

        descriptor?.className?.let { className ->
          tasks.entries
              .find { (_, v) -> v.testClassName == className }
              ?.key
              ?.let { nxTaskId ->
                testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
                logger.info("🏁 Test start: $nxTaskId $className")
              }
        }
      }

      is TestFinishEvent -> {
        val descriptor = event.descriptor as? JvmTestOperationDescriptor
        val className = descriptor?.className
        val nxTaskId =
            className?.let { name -> tasks.entries.find { (_, v) -> v.testClassName == name }?.key }

        nxTaskId?.let {
          testEndTimes[it] = event.result.endTime

          val isClassLevel = descriptor.methodName == null
          val passed = event.result is TestSuccessResult || event.result is TestSkippedResult

          if (isClassLevel) {
            // Class-level result is authoritative for the Nx task; emit now.
            testTaskStatus[it] = passed
            when (event.result) {
              is TestSuccessResult ->
                  logger.info(
                      "✅ Test class passed at ${formatMillis(event.result.endTime)}: $it $className")
              is TestFailureResult -> logger.warning("❌ Test class failed: $it $className")
              is TestSkippedResult -> logger.warning("⚠️ Test class skipped: $it $className")
              else -> logger.warning("⚠️ Unknown test class result: $it $className")
            }
            onTestTaskComplete(it)
          } else {
            // Method-level: failure is sticky so a later passing method can't mask it.
            val name = descriptor.methodName ?: className ?: "unknown"
            when (event.result) {
              is TestSuccessResult -> {
                testTaskStatus.putIfAbsent(it, true)
                logger.info("✅ Test passed at ${formatMillis(event.result.endTime)}: $it $name")
              }
              is TestFailureResult -> {
                testTaskStatus[it] = false
                logger.warning("❌ Test failed: $it $name")
              }
              is TestSkippedResult -> {
                testTaskStatus.putIfAbsent(it, true)
                logger.warning("⚠️ Test skipped: $it $name")
              }
              else -> {
                testTaskStatus.putIfAbsent(it, true)
                logger.warning("⚠️ Unknown test result: $it $name")
              }
            }
          }
        }
      }
    }
  }
}
