package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.util.formatMillis
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.OperationDescriptor
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.test.*

fun testListener(
    tasks: Map<String, GradleTask>,
    testTaskStatus: MutableMap<String, Boolean>,
    testStartTimes: MutableMap<String, Long>,
    testEndTimes: MutableMap<String, Long>,
    onTestOutput: (nxTaskId: String, message: String) -> Unit = { _, _ -> },
    onTestTaskComplete: (nxTaskId: String) -> Unit = {},
): (ProgressEvent) -> Unit {
  val classNameToTaskId: Map<String, String> =
      tasks.entries.mapNotNull { (id, task) -> task.testClassName?.let { it to id } }.toMap()
  val taskPathToTaskIds: Map<String, List<String>> =
      tasks.entries.groupBy({ normalizeTaskPath(it.value.taskName) }, { it.key })

  if (System.getenv("NX_GRADLE_BATCH_DEBUG_TESTS") == "true") {
    System.err.println("[nx-test-debug] classNameToTaskId=$classNameToTaskId")
    System.err.println("[nx-test-debug] taskPathToTaskIds=$taskPathToTaskIds")
  }
  val debugTests = System.getenv("NX_GRADLE_BATCH_DEBUG_TESTS") == "true"

  // Walk up the parent chain to find the test class this output came from,
  // then map that class name to its Nx task id.
  fun findNxTaskIdForOutput(descriptor: OperationDescriptor): String? {
    var current: OperationDescriptor? = descriptor.parent
    while (current != null) {
      if (current is JvmTestOperationDescriptor) {
        val className = current.className
        if (className != null) {
          classNameToTaskId[className]?.let {
            return it
          }
        }
      }
      current = current.parent
    }
    return null
  }

  return { event ->
    when (event) {
      is TestOutputEvent -> {
        val message = event.descriptor.message
        // Subscribing to TEST_OUTPUT diverts test stdout/stderr through events instead of
        // the build's standard output stream, so we have to echo it ourselves for live display.
        // Both stdout and stderr go to System.err — System.out is reserved for NX_RESULT lines.
        System.err.print(message)
        findNxTaskIdForOutput(event.descriptor)?.let { nxTaskId -> onTestOutput(nxTaskId, message) }
      }

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
        if (debugTests) {
          val d = event.descriptor as? JvmTestOperationDescriptor
          System.err.println(
              "[nx-test-debug] TestStartEvent class=${d?.className} method=${d?.methodName} type=${event.descriptor::class.simpleName}")
        }
        (event.descriptor as? JvmTestOperationDescriptor)?.className?.let { className ->
          classNameToTaskId[className]?.let { nxTaskId ->
            testStartTimes.computeIfAbsent(nxTaskId) { event.eventTime }
            logger.info("🏁 Test start: $nxTaskId $className")
          }
        }
      }

      is TestFinishEvent -> {
        if (debugTests) {
          val d = event.descriptor as? JvmTestOperationDescriptor
          System.err.println(
              "[nx-test-debug] TestFinishEvent class=${d?.className} method=${d?.methodName} type=${event.descriptor::class.simpleName}")
        }
        (event.descriptor as? JvmTestOperationDescriptor)?.let { descriptor ->
          val className = descriptor.className ?: return@let
          val nxTaskId = classNameToTaskId[className] ?: return@let

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
