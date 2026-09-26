package dev.nx.gradle.utils

import groovy.lang.Closure
import java.util.Collections
import java.util.IdentityHashMap
import java.util.WeakHashMap
import java.util.concurrent.Callable
import org.gradle.api.Action
import org.gradle.api.Buildable
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.internal.GradleInternal
import org.gradle.api.internal.tasks.CachingTaskDependencyResolveContext
import org.gradle.api.internal.tasks.DefaultTaskDependency
import org.gradle.api.internal.tasks.TaskDependencyContainer
import org.gradle.api.internal.tasks.TaskResolver
import org.gradle.api.internal.tasks.WorkDependencyResolver
import org.gradle.api.internal.tasks.WorkNodeAction
import org.gradle.api.tasks.TaskContainer
import org.gradle.internal.build.BuildState
import org.gradle.util.Path as GradlePath

private val dependsOnExpansionCache: MutableMap<Task, List<Any>> =
    Collections.synchronizedMap(WeakHashMap())

/** Memoized: it invokes user closures, which must not run once per caller. */
private fun flattenDependsOn(task: Task): List<Any> =
    dependsOnExpansionCache[task]
        ?: computeFlattenDependsOn(task).also { dependsOnExpansionCache[task] = it }

private fun computeFlattenDependsOn(task: Task): List<Any> = flattenValues(task, task.dependsOn)

// `dependsOn: [a, b]` is ONE element. Descend only List/Set/Array — a FileCollection is Iterable
// too, and iterating one resolves it.
private fun flattenValues(task: Task, values: Collection<Any?>): List<Any> {
  val flattened = mutableListOf<Any>()
  // Identity-keyed cycle guard: Gradle's own visitDependencies has none and loops forever.
  val seen = Collections.newSetFromMap(IdentityHashMap<Any, Boolean>())
  fun visit(value: Any?) {
    when (value) {
      null -> {}
      is List<*> -> if (seen.add(value)) value.forEach(::visit)
      is Set<*> -> if (seen.add(value)) value.forEach(::visit)
      is Array<*> -> if (seen.add(value)) value.forEach(::visit)
      // Must precede Callable: Closure extends it, and Gradle passes the task to
      // `dependsOn { … }` — calling with no argument throws.
      is Closure<*> ->
          if (seen.add(value)) {
            try {
              visit(value.call(task))
            } catch (e: Exception) {
              task.logger.info("Cannot expand dependsOn closure for ${task.path}: ${e.message}")
              flattened.add(value)
            }
          }
      is Callable<*> ->
          if (seen.add(value)) {
            try {
              visit(value.call())
            } catch (e: Exception) {
              task.logger.info("Cannot expand dependsOn callable for ${task.path}: ${e.message}")
              flattened.add(value)
            }
          }
      else -> flattened.add(value)
    }
  }
  values.forEach(::visit)
  return flattened
}

internal data class DependsOnResolution(val tasks: Set<Task>, val unresolved: Int)

/** Weak Task keys, not `task.path`: paths collide across included builds. */
private val dependsOnResolutionCache: MutableMap<Task, DependsOnResolution> =
    Collections.synchronizedMap(WeakHashMap())

/** Deadlock-free lookup: findProject + findByName never enter `ensureProjectsConfigured`. */
internal fun lookupTask(owner: Project, p: String): Task? {
  val sep = p.lastIndexOf(':')
  return if (sep < 0) {
    owner.tasks.findByName(p)
  } else {
    val taskName = p.substring(sep + 1)
    if (taskName.isEmpty()) {
      null
    } else {
      val prefix = p.substring(0, sep)
      val projectPath =
          when {
            p.startsWith(":") -> prefix.ifEmpty { ":" }
            owner.path == ":" -> ":$prefix"
            else -> "${owner.path}:$prefix"
          }
      owner.rootProject.findProject(projectPath)?.tasks?.findByName(taskName)
    }
  }
}

/** A container's own resolver; null when it cannot be read. */
private fun resolverOf(dep: DefaultTaskDependency): TaskResolver? =
    try {
      DefaultTaskDependency::class.java.getDeclaredField("resolver").let {
        it.isAccessible = true
        it.get(dep) as? TaskResolver
      }
    } catch (t: Throwable) {
      null
    }

/**
 * A bare name through a container's own resolver. That branch is lock-free on both majors (it ends
 * in the project's own `getByName`); only a qualified path enters the build-scoped resolver.
 * [TaskResolver.resolveTask] took a String in Gradle 8 and a [GradlePath] in 9, hence reflection.
 */
private fun resolveBareName(resolver: TaskResolver, name: String): Task? =
    try {
      val method =
          TaskResolver::class.java.methods.first {
            it.name == "resolveTask" && it.parameterCount == 1 && !it.isBridge
          }
      val arg: Any =
          if (method.parameterTypes[0] == String::class.java) name else GradlePath.path(name)
      method.invoke(resolver, arg) as? Task
    } catch (t: Throwable) {
      null
    }

/** A private field by name, searched up the class hierarchy; null when absent or unreadable. */
private fun readField(target: Any, name: String): Any? =
    try {
      generateSequence<Class<*>>(target.javaClass) { it.superclass }
          .mapNotNull { c -> c.declaredFields.firstOrNull { it.name == name } }
          .firstOrNull()
          ?.let {
            it.isAccessible = true
            it.get(target)
          }
    } catch (t: Throwable) {
      null
    }

/**
 * The root project of the build a container's resolver belongs to, when that is not [owner]'s
 * build: an absolute path is only unambiguous within a build, and `includedBuild.task(":x")` hands
 * the consumer a container bound to the included build. Gradle 9 keeps the build on the resolver
 * chain; Gradle 8's resolver is the project's task container. Null when it is the same build or
 * cannot be read.
 */
private fun foreignBuildRoot(owner: Project, resolver: TaskResolver): Project? =
    try {
      val build =
          readField(resolver, "build")
              ?: readField(resolver, "buildTaskResolver")?.let { readField(it, "build") }
      val ownerGradle = owner.gradle as GradleInternal
      when {
        build is BuildState ->
            if (build === ownerGradle.owner) null else build.mutableModel.rootProject
        resolver is TaskContainer ->
            (readField(resolver, "project") as? Project)
                ?.takeIf { it.gradle !== owner.gradle }
                ?.rootProject
        else -> null
      }
    } catch (t: Throwable) {
      null
    }

/**
 * Bare names resolve where Gradle would resolve them — in the container's own project via
 * [original] — and qualified paths through [lookupTask], in [foreignRoot]'s build when the
 * container came from another build. A bare name has no safe answer in a [nested] container whose
 * resolver could not be read, nor in one from another build. Both JVM descriptors are implemented.
 */
private class SafeTaskResolver(
    private val owner: Project,
    private val original: TaskResolver?,
    private val nested: Boolean,
    private val foreignRoot: Project? = null
) : TaskResolver {
  fun resolve(path: String): Task? =
      when {
        path.contains(':') -> lookupTask(foreignRoot ?: owner, path)
        foreignRoot != null -> null // a bare name's project is unknown across builds
        original != null -> resolveBareName(original, path)
        nested -> null
        else -> lookupTask(owner, path)
      }

  override fun resolveTask(path: String): Task? = resolve(path)

  @Suppress("unused") fun resolveTask(path: GradlePath): Task? = resolve(path.path)
}

/** The values a [DefaultTaskDependency] was built with; null when they cannot be read. */
private fun immutableValuesOf(dep: DefaultTaskDependency): Set<*>? =
    try {
      DefaultTaskDependency::class.java.getDeclaredField("immutableValues").let {
        it.isAccessible = true
        it.get(dep) as? Set<*>
      }
    } catch (t: Throwable) {
      null
    }

/**
 * Gradle's own resolve context, with one interception: a [DefaultTaskDependency] holding a
 * qualified path is swapped for a copy resolving through [SafeTaskResolver]. Only that class
 * resolves a path, and only a qualified one deadlocks (#36668); a container without one is passed
 * through untouched. What cannot be resolved safely is dropped and counted in [lost].
 */
private class SafeResolveContext
private constructor(private val owner: Project, private val task: Task, val lost: LostCounter) :
    CachingTaskDependencyResolveContext<Task>(listOf(WorkDependencyResolver.TASK_AS_TASK, lost)) {
  constructor(owner: Project, task: Task) : this(owner, task, LostCounter())

  /** Counts what the engine cannot turn into a task, except the transform nodes Gradle ignores. */
  class LostCounter : WorkDependencyResolver<Task> {
    var count = 0

    override fun resolve(task: Task, node: Any, resolveAction: Action<in Task>): Boolean {
      if (node !is WorkNodeAction && node.javaClass.simpleName != "TransformNodeDependency") count++
      return true
    }
  }

  override fun add(dependency: Any) {
    when (dependency) {
      is DefaultTaskDependency -> super.add(screened(dependency))
      is TaskDependencyContainer -> super.add(dependency)
      // The walker visits a bare Buildable's dependencies directly, skipping this hook.
      is Buildable -> add(dependency.buildDependencies)
      else -> super.add(dependency)
    }
  }

  /**
   * Strings are pre-resolved so an unknown one is counted rather than handed to the engine as null.
   * A relative path with a segment (`sub:jar`) inside a [nested] container from another project is
   * ambiguous and counted.
   */
  fun screenedCopy(
      values: Collection<Any?>,
      original: TaskResolver? = null,
      nested: Boolean = false
  ): DefaultTaskDependency {
    val foreignRoot = original?.let { foreignBuildRoot(owner, it) }
    val resolver = SafeTaskResolver(owner, original, nested, foreignRoot)
    val copy = DefaultTaskDependency(resolver, null)
    flattenValues(task, values).forEach { value ->
      if (value is CharSequence) {
        val path = value.toString()
        val relativeSegments = path.contains(':') && !path.startsWith(":")
        if (!(nested && relativeSegments) && resolver.resolve(path) != null) copy.add(value)
        else lost.count++
      } else {
        copy.add(value)
      }
    }
    return copy
  }

  private fun screened(dep: DefaultTaskDependency): TaskDependencyContainer {
    val immutable = immutableValuesOf(dep)
    val values = (immutable ?: emptySet<Any>()) + dep.mutableValues
    val qualified = flattenValues(task, values).any { it is CharSequence && it.contains(':') }
    if (!qualified && immutable != null) return dep
    if (immutable == null) lost.count++
    return screenedCopy(values, original = resolverOf(dep), nested = true)
  }
}

/** Gradle's engine over [SafeResolveContext]; failure keeps the Tasks in hand and fails open. */
internal fun resolveDependsOn(task: Task): DependsOnResolution =
    dependsOnResolutionCache[task]
        ?: computeResolveDependsOn(task).also { dependsOnResolutionCache[task] = it }

private fun computeResolveDependsOn(task: Task): DependsOnResolution {
  val context = SafeResolveContext(task.project, task)
  return try {
    val root = context.screenedCopy(task.dependsOn)
    root.add(task.inputs)
    DependsOnResolution(context.getDependencies(task, root), context.lost.count).also {
      task.logger.info("Dependencies for ${task.path}: ${it.tasks.map { t -> t.path }}")
    }
  } catch (e: Throwable) {
    task.logger.info("Safe dependency resolution failed for ${task.path}: ${e.message}")
    val values = flattenDependsOn(task)
    // The whole inputs half is lost too, so this always fails open.
    DependsOnResolution(values.filterIsInstance<Task>().toSet(), 1 + values.count { it !is Task })
  }
}

/**
 * A task's direct dependencies: both halves of Gradle's `getTaskDependencies()`, resolved safely.
 */
fun getDependsOnTask(task: Task): Set<Task> = resolveDependsOn(task).tasks
