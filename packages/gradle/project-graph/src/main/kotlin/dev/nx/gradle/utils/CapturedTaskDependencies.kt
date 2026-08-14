package dev.nx.gradle.utils

import java.util.IdentityHashMap
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.execution.TaskExecutionGraph
import org.gradle.api.invocation.Gradle

const val NX_PROJECT_REPORT_TASK_NAME = "nxProjectReport"

const val NX_PROJECT_GRAPH_TASK_NAME = "nxProjectGraph"

/** Direct dependencies of a task, keyed by task identity. */
typealias DependsOnIndex = Map<Task, Set<Task>>

/**
 * Direct task dependencies resolved during the configuration phase and read back by
 * [NxProjectReportTask][dev.nx.gradle.NxProjectReportTask] during execution.
 *
 * `task.taskDependencies.getDependencies(task)` is the only complete view of a task's direct
 * dependencies: `task.dependsOn` holds the raw declared values (Strings, `TaskProvider`s,
 * `TaskReference`s, file collections) and keeping only the values that happen to be literal `Task`
 * instances drops most real edges. Resolving the rest needs the task resolver, and for a dependency
 * naming a task in another project that routes through
 * `AbstractBuildState.ensureProjectsConfigured` ->
 * `DefaultBuildLifecycleController.configureProjects` -> `DefaultSynchronizer.takeOwnership`. The
 * build lifecycle state lock cannot be granted to an execution worker, so calling it from the
 * report task's action blocks that worker forever and the build never completes.
 *
 * The resolution therefore happens once per project, on the build thread, while the build is still
 * configuring; the report task only reads the captured result.
 */
object CapturedTaskDependencies {
  private val current = ThreadLocal<DependsOnIndex?>()

  /** Make [index] the lookup source for [block] on the calling thread. */
  fun <T> withIndex(index: DependsOnIndex, block: () -> T): T {
    val previous = current.get()
    current.set(index)
    return try {
      block()
    } finally {
      current.set(previous)
    }
  }

  /** Captured dependencies for [task], or null when nothing was captured for it. */
  fun lookup(task: Task): Set<Task>? = current.get()?.get(task)

  /**
   * True while a captured index is in scope, i.e. while the report task action is running on an
   * execution worker. Callers outside that scope — tests, and any other consumer of
   * [getDependsOnTask] — are on the build thread and can resolve dependencies directly.
   */
  fun isActive(): Boolean = current.get() != null
}

/**
 * True when this build run is computing the Nx project graph. Included builds do not schedule the
 * requested task names themselves, so the task graph is checked as well as the start parameter.
 */
private fun nxGraphRequested(gradle: Gradle, graph: TaskExecutionGraph): Boolean {
  val requestedByName =
      gradle.startParameter.taskNames.any {
        val name = it.substringAfterLast(':')
        name == NX_PROJECT_REPORT_TASK_NAME || name == NX_PROJECT_GRAPH_TASK_NAME
      }
  if (requestedByName) return true
  return graph.allTasks.any {
    it.name == NX_PROJECT_REPORT_TASK_NAME || it.name == NX_PROJECT_GRAPH_TASK_NAME
  }
}

/**
 * Resolve the direct dependencies of every task in [project], and transitively of every task those
 * dependencies reach within the same build, into a per-build index.
 *
 * The transitive walk exists because the input derivation sees through opaque lifecycle tasks (e.g.
 * `classes` -> `processResources`) and so asks for the dependencies of tasks it did not start from.
 * The walk stops at a build boundary: resolving the dependencies of a task owned by another build
 * would take that build's lifecycle lock from this build's thread.
 */
private fun captureDependsOn(project: Project): DependsOnIndex {
  val index = sharedIndexFor(project.gradle)
  val gradle = project.gradle
  val queue = ArrayDeque(project.tasks.toList())
  while (queue.isNotEmpty()) {
    val task = queue.removeFirst()
    if (index.containsKey(task)) continue
    val dependencies = resolveDirectDependencies(task)
    index[task] = dependencies
    dependencies.forEach { dependency ->
      if (dependency.project.gradle === gradle) queue.addLast(dependency)
    }
  }
  return index
}

/**
 * One shared index per build: every project's capture contributes to it and every project's report
 * reads from it, so a task shared between projects is resolved once. It hangs off the root project
 * so it dies with the build model rather than living in the daemon.
 */
@Suppress("UNCHECKED_CAST")
private fun sharedIndexFor(gradle: Gradle): MutableMap<Task, Set<Task>> {
  val extra = gradle.rootProject.extensions.extraProperties
  val key = "dev.nx.gradle.capturedTaskDependencies"
  if (!extra.has(key)) {
    extra.set(key, IdentityHashMap<Task, Set<Task>>())
  }
  return extra.get(key) as MutableMap<Task, Set<Task>>
}

private fun resolveDirectDependencies(task: Task): Set<Task> {
  val declared =
      try {
        task.dependsOn.filterIsInstance<Task>().toSet()
      } catch (e: Exception) {
        task.logger.info("Cannot access task.dependsOn for ${task.path}: ${e.message}")
        emptySet()
      }
  val resolved =
      try {
        task.taskDependencies.getDependencies(task)
      } catch (e: Exception) {
        task.logger.info("Cannot resolve task dependencies for ${task.path}: ${e.message}")
        emptySet()
      }
  return declared + resolved
}

/**
 * Capture [project]'s task dependencies once the task graph is ready, so the report task action can
 * read them instead of resolving them from an execution worker. Skipped entirely unless this build
 * run is computing the Nx project graph, so an ordinary build pays nothing.
 */
fun registerDependsOnCapture(project: Project, applyIndex: (DependsOnIndex) -> Unit) {
  project.gradle.taskGraph.whenReady { graph ->
    if (!nxGraphRequested(project.gradle, graph)) return@whenReady
    applyIndex(captureDependsOn(project))
  }
}
