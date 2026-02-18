package dev.nx.maven.utils

import dev.nx.maven.data.TaskGraph
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("TaskGraphUtils")

/**
 * Removes completed tasks from the task graph and recalculates roots.
 * If tasks failed, also removes all tasks that transitively depend on them.
 * This follows the pattern from packages/nx/src/tasks-runner/utils.ts
 *
 * @param graph The current task graph
 * @param completedTaskIds IDs of tasks that have been completed (successfully)
 * @param failedTaskIds IDs of tasks that failed (optional)
 * @return A new TaskGraph with completed/failed tasks and their dependents removed, roots recalculated
 */
fun removeTasksFromTaskGraph(
  graph: TaskGraph,
  completedTaskIds: List<String>,
  failedTaskIds: List<String> = emptyList()
): TaskGraph {
  val completedSet = completedTaskIds.toSet()
  val failedSet = failedTaskIds.toSet()

  // Build a reverse dependency map: for each task, which tasks depend on it?
  val reverseDependencies = buildReverseDependencyMap(graph.dependencies)
  val reverseContinuousDependencies =
    buildReverseDependencyMap(graph.continuousDependencies)

  // Find all tasks that transitively depend on failed tasks
  val tasksToRemove = mutableSetOf<String>()
  tasksToRemove.addAll(completedSet)
  tasksToRemove.addAll(failedSet)

  // For each failed task, recursively find all transitive dependents
  for (failedTask in failedSet) {
    val dependents = findTransitiveDependents(
      failedTask,
      reverseDependencies,
      reverseContinuousDependencies
    )
    tasksToRemove.addAll(dependents)

    if (dependents.isNotEmpty()) {
      log.debug(
        "Task '$failedTask' failed. Skipping dependent tasks: ${dependents.joinToString(", ")}"
      )
    }
  }

  // Filter tasks map to remove completed/failed/dependent tasks
  val filteredTasks = graph.tasks.filterKeys { !tasksToRemove.contains(it) }

  // Filter dependencies, removing tasks to remove from all dependency lists
  val filteredDependencies = mutableMapOf<String, List<String>>()
  for ((taskId, deps) in graph.dependencies) {
    if (!tasksToRemove.contains(taskId)) {
      filteredDependencies[taskId] = deps.filterNot { tasksToRemove.contains(it) }
    }
  }

  // Filter continuous dependencies similarly
  val filteredContinuousDependencies = mutableMapOf<String, List<String>>()
  for ((taskId, deps) in graph.continuousDependencies) {
    if (!tasksToRemove.contains(taskId)) {
      filteredContinuousDependencies[taskId] =
        deps.filterNot { tasksToRemove.contains(it) }
    }
  }

  // Recalculate roots: tasks with no dependencies and no continuous dependencies
  val newRoots = filteredTasks.keys.filter { taskId ->
    (filteredDependencies[taskId]?.isEmpty() ?: true) &&
      (filteredContinuousDependencies[taskId]?.isEmpty() ?: true)
  }

  return TaskGraph(
    roots = newRoots,
    tasks = filteredTasks,
    dependencies = filteredDependencies,
    continuousDependencies = filteredContinuousDependencies
  )
}

/**
 * Builds a reverse dependency map: for each task ID, returns list of tasks that depend on it.
 *
 * @param dependencyMap Original dependency map: taskId -> list of dependencies
 * @return Reverse map: taskId -> list of tasks that depend on it
 */
private fun buildReverseDependencyMap(
  dependencyMap: Map<String, List<String>>
): Map<String, MutableList<String>> {
  val reverseDeps = mutableMapOf<String, MutableList<String>>()

  for ((taskId, dependencies) in dependencyMap) {
    for (dep in dependencies) {
      reverseDeps.computeIfAbsent(dep) { mutableListOf() }.add(taskId)
    }
  }

  return reverseDeps
}

/**
 * Recursively finds all tasks that (directly or transitively) depend on the given task.
 *
 * @param taskId The task ID to find dependents for
 * @param reverseDependencies Reverse dependency map for regular dependencies
 * @param reverseContinuousDependencies Reverse dependency map for continuous dependencies
 * @return Set of all transitive dependent task IDs
 */
private fun findTransitiveDependents(
  taskId: String,
  reverseDependencies: Map<String, MutableList<String>>,
  reverseContinuousDependencies: Map<String, MutableList<String>>
): Set<String> {
  val allDependents = mutableSetOf<String>()
  val queue = mutableListOf(taskId)

  while (queue.isNotEmpty()) {
    val current = queue.removeAt(0)

    // Find direct dependents
    val directDependents =
      (reverseDependencies[current] ?: emptyList()).union(
        reverseContinuousDependencies[current] ?: emptyList()
      )

    for (dependent in directDependents) {
      if (!allDependents.contains(dependent)) {
        allDependents.add(dependent)
        queue.add(dependent) // Add to queue to find its dependents
      }
    }
  }

  return allDependents
}
