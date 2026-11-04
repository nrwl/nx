package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import dev.nx.gradle.util.logger
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskOperationDescriptor
import org.gradle.tooling.events.task.TaskOperationResult
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
    capture: TaskOutputCapture,
    emitForTaskPath: (taskPath: String, output: String) -> Unit
): (ProgressEvent) -> Unit {
  val nxTaskIdByPath = buildMap {
    tasks.forEach { (nxTaskId, task) -> putIfAbsent(normalizeTaskPath(task.taskName), nxTaskId) }
  }
  // Gradle task path -> start time, for tasks that did work of their own (ran their actions, or
  // restored them from the build cache). Skipped, NO-SOURCE, up-to-date and lifecycle tasks are
  // left out.
  val workStartTimes = mutableMapOf<String, Long>()

  return { event ->
    when (event) {
      is TaskStartEvent -> {
        // Listener thread leads the writer thread; retry parked emits whose bytes have now landed.
        pendingEmit.keys.toList().forEach { parked ->
          val captured = capture.getOutput(parked)
          if (captured.isNotEmpty()) emitForTaskPath(parked, captured)
        }

        val taskPath = event.descriptor.taskPath
        nxTaskIdByPath[normalizeTaskPath(taskPath)]?.let { nxTaskId ->
          taskStartTimes[nxTaskId] = event.eventTime
          logger.info("🏁 Task start: $nxTaskId $taskPath")
        }
      }

      is TaskFinishEvent -> {
        val taskPath = event.descriptor.taskPath
        val result = event.result
        if (didOwnWork(result)) workStartTimes[normalizeTaskPath(taskPath)] = result.startTime
        val success = getTaskFinishEventSuccess(event, taskPath)
        nxTaskIdByPath[normalizeTaskPath(taskPath)]?.let { nxTaskId ->
          val ownStart = taskStartTimes[nxTaskId] ?: result.startTime
          val startTime =
              if (didNoOwnWork(result)) {
                earliestDependencyWorkStart(event.descriptor, workStartTimes, nxTaskIdByPath.keys)
                    ?.let { minOf(it, ownStart) } ?: ownStart
              } else ownStart
          taskResults[nxTaskId] = TaskResult.fromBoolean(success, startTime, result.endTime, "")
          pendingEmit[taskPath] = nxTaskId
        }
      }
    }
  }
}

/** The task ran its actions, or restored them from the build cache. */
private fun didOwnWork(result: TaskOperationResult): Boolean =
    when (result) {
      is TaskSuccessResult -> !didNoOwnWork(result)
      is TaskFailureResult -> true
      else -> false
    }

/**
 * The task succeeded without running any actions: it was up to date, or it is a lifecycle task that
 * only depends on others (`classes`, `assemble`). Gradle reports a lifecycle task whose
 * dependencies did work as not up to date, but always gives a reason when it runs actions, so an
 * empty list of execution reasons marks one. When the reasons are unknown (`null`, from a Gradle
 * that does not report them) the task is taken to have done work, so it keeps its own start.
 */
private fun didNoOwnWork(result: TaskOperationResult): Boolean =
    result is TaskSuccessResult &&
        !result.isFromCache &&
        (result.isUpToDate || result.executionReasons?.isEmpty() == true)

/**
 * Earliest start among the Gradle tasks [descriptor] transitively depends on that did work. Used
 * for a task that did no work itself, so its time covers the work it waited on: without this a
 * lifecycle task over a long compile reports about 0ms. Stops at tasks in [nxTaskPaths]: they
 * report their own time, so counting them would double-count it.
 */
internal fun earliestDependencyWorkStart(
    descriptor: TaskOperationDescriptor,
    workStartTimes: Map<String, Long>,
    nxTaskPaths: Set<String>,
): Long? {
  val visited = mutableSetOf<String>()
  var earliest: Long? = null
  val queue = ArrayDeque(descriptor.dependencies.filterIsInstance<TaskOperationDescriptor>())
  while (queue.isNotEmpty()) {
    val dep = queue.removeFirst()
    val path = normalizeTaskPath(dep.taskPath)
    if (!visited.add(path) || path in nxTaskPaths) continue
    workStartTimes[path]?.let { start -> earliest = minOf(earliest ?: start, start) }
    queue.addAll(dep.dependencies.filterIsInstance<TaskOperationDescriptor>())
  }
  return earliest
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
