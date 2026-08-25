package dev.nx.gradle.utils

import dev.nx.gradle.NxTaskExtension
import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.DependsOnEntry
import dev.nx.gradle.data.ExternalDepData
import dev.nx.gradle.data.ExternalNode
import groovy.lang.Closure
import java.io.File
import java.util.Collections
import java.util.IdentityHashMap
import java.util.WeakHashMap
import java.util.concurrent.Callable
import kotlin.io.path.Path
import org.gradle.api.Action
import org.gradle.api.Buildable
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.FileSystemLocation
import org.gradle.api.internal.GradleInternal
import org.gradle.api.internal.TaskInternal
import org.gradle.api.internal.provider.ProviderInternal
import org.gradle.api.internal.provider.TransformBackedProvider
import org.gradle.api.internal.tasks.CachingTaskDependencyResolveContext
import org.gradle.api.internal.tasks.DefaultTaskDependency
import org.gradle.api.internal.tasks.TaskDependencyContainer
import org.gradle.api.internal.tasks.TaskResolver
import org.gradle.api.internal.tasks.WorkDependencyResolver
import org.gradle.api.internal.tasks.WorkNodeAction
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.AbstractCopyTask
import org.gradle.api.tasks.TaskContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.bundling.AbstractArchiveTask
import org.gradle.api.tasks.bundling.Compression
import org.gradle.api.tasks.bundling.Tar
import org.gradle.api.tasks.compile.AbstractCompile
import org.gradle.api.tasks.testing.Test as GradleTest
import org.gradle.internal.build.BuildState
import org.gradle.util.Path as GradlePath

private val kotlinCompileToolClass: Class<*>? by lazy {
  try {
    Class.forName("org.jetbrains.kotlin.gradle.tasks.AbstractKotlinCompileTool")
  } catch (e: Throwable) {
    null
  }
}

private fun isKotlinCompileTask(task: Task): Boolean =
    kotlinCompileToolClass?.isInstance(task) == true

/** Weak Task keys, not `task.path`: paths collide across included builds. */
private val dependsOnTaskCache: MutableMap<Task, Set<Task>> =
    Collections.synchronizedMap(WeakHashMap())

private val dependentOutputPatternsCache: MutableMap<Task, Set<String>> =
    Collections.synchronizedMap(WeakHashMap())

/** Escape hatch: keep only the Task objects in dependsOn and fail inputs open. */
private val skipTaskDependencyResolution: Boolean =
    System.getenv("NX_GRADLE_SKIP_TASK_DEPS")?.toBoolean() == true

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
private fun resolveDependsOn(task: Task): DependsOnResolution =
    dependsOnResolutionCache[task]
        ?: computeResolveDependsOn(task).also { dependsOnResolutionCache[task] = it }

private fun computeResolveDependsOn(task: Task): DependsOnResolution {
  val context = SafeResolveContext(task.project, task)
  return try {
    val root = context.screenedCopy(task.dependsOn)
    root.add(task.inputs)
    DependsOnResolution(context.getDependencies(task, root), context.lost.count)
  } catch (e: Throwable) {
    task.logger.info("Safe dependency resolution failed for ${task.path}: ${e.message}")
    val values = flattenDependsOn(task)
    // The whole inputs half is lost too, so this always fails open.
    DependsOnResolution(values.filterIsInstance<Task>().toSet(), 1 + values.count { it !is Task })
  }
}

/**
 * Process a task and convert it into target Going to populate:
 * - cache
 * - inputs
 * - outputs
 * - command
 * - metadata
 */
fun processTask(
    task: Task,
    projectBuildPath: String,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>,
    dependencies: MutableSet<Dependency>,
    targetNameOverrides: Map<String, String>,
    gitIgnoreClassifier: GitIgnoreClassifier,
    targetNamePrefix: String = "",
    project: Project,
): MutableMap<String, Any?> =
    NxTracing.withSpan("processTask", mapOf("task" to task.path)) {
      processTaskImpl(
          task,
          projectBuildPath,
          projectRoot,
          workspaceRoot,
          externalNodes,
          dependencies,
          targetNameOverrides,
          gitIgnoreClassifier,
          targetNamePrefix,
          project)
    }

private fun processTaskImpl(
    task: Task,
    projectBuildPath: String,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>,
    dependencies: MutableSet<Dependency>,
    targetNameOverrides: Map<String, String>,
    gitIgnoreClassifier: GitIgnoreClassifier,
    targetNamePrefix: String = "",
    project: Project,
): MutableMap<String, Any?> {
  val logger = task.logger
  logger.info("NxProjectReportTask: process $task for $projectRoot")
  val target = mutableMapOf<String, Any?>()
  target["cache"] = isCacheable(task)

  val continuous = isContinuous(task)
  if (continuous) {
    target["continuous"] = true
  }

  val dependsOnTasks = getDependsOnTask(task)

  val outputs = getOutputsForTask(task, projectRoot, workspaceRoot)
  if (!outputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${outputs.size} outputs")
    target["outputs"] = outputs
  }

  val dependsOn =
      getDependsOnForTask(dependsOnTasks, task, dependencies, targetNameOverrides, targetNamePrefix)

  if (!dependsOn.isNullOrEmpty()) {
    logger.info("${task}: processed ${dependsOn.size} total dependsOn")
    target["dependsOn"] = dependsOn
  }

  val nxExtension = task.extensions.findByType(NxTaskExtension::class.java)
  nxExtension?.json?.getOrNull()?.let { nxJson -> target["nxConfig"] = nxJson }

  val inputs =
      getInputsForTask(
          dependsOnTasks, task, projectRoot, workspaceRoot, externalNodes, gitIgnoreClassifier)
  if (!inputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${inputs.size} inputs")
    target["inputs"] = inputs
  }

  target["executor"] = "@nx/gradle:gradle"

  val metadata =
      getMetadata(
          task.description ?: "Run ${projectBuildPath}.${task.name}", projectBuildPath, task.name)
  target["metadata"] = metadata

  target["options"] = buildMap {
    put("taskName", "${projectBuildPath}:${task.name}")
    val providerDependencies = findProviderBasedDependencies(task)
    if (providerDependencies.isNotEmpty()) {
      // sorted(): set iteration order is JVM-run-dependent; keep options hash-stable.
      put("includeDependsOnTasks", providerDependencies.sorted())
    }
    if (continuous) {
      put("continuous", true)
    }
  }

  return target
}

fun getGradlewCommand(): String {
  val operatingSystem = System.getProperty("os.name").lowercase()
  return if (operatingSystem.contains("win")) {
    ".\\gradlew.bat"
  } else {
    "./gradlew"
  }
}

private val GRADLE_INPUT_FILES =
    listOf(
        "gradle/wrapper/gradle-wrapper.jar",
        "gradle/wrapper/gradle-wrapper.properties",
        "gradle.properties")

/**
 * Get gradle wrapper and properties files that should be included as inputs. These files affect
 * build behavior and should invalidate cache when changed.
 *
 * @param workspaceRoot the workspace root path
 * @return list of relative paths to gradle files that exist, empty if none found
 */
fun getGradleFilesInputs(workspaceRoot: String): List<String> {
  return GRADLE_INPUT_FILES.filter { relativePath -> File("$workspaceRoot/$relativePath").exists() }
      .map { relativePath -> Path("{workspaceRoot}", relativePath).toString() }
}

/**
 * Extension-level view of the input derivation, used by unit tests. Production uses
 * [dependentOutputPatterns]. The task itself is not routed through [dependencyOutputExtensions] so
 * it does not gain a self-input from its own outputs.
 */
fun inferExtensionsFromInputProperties(
    task: Task,
    dependentTasks: Set<Task>,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<String> {
  val extensions = mutableSetOf<String>()
  extensions.addAll(extensionsForTaskType(task))
  extensions.addAll(declaredCopySourceExtensions(task, gitIgnoreClassifier))
  dependentTasks.forEach { depTask -> extensions.addAll(dependencyOutputExtensions(depTask)) }
  return extensions.toSet()
}

/**
 * Output extensions a dependency task produces. A consumer hashes the dependency's OUTPUT, so this
 * reads declared outputs, never sources. A Copy names nothing here; its directory output gets the
 * catch-all in [dependentOutputPatterns].
 */
private fun dependencyOutputExtensions(task: Task): Set<String> {
  val byKind =
      when {
        task is AbstractArchiveTask -> declaredArchiveExtensions(task)
        else -> extensionsForTaskType(task)
      }
  return byKind + declaredFileOutputExtensions(task)
}

/**
 * dependentTasksOutputFiles patterns for one dependency: per-extension globs when nameable,
 * otherwise the wildcard catch-all for a declared directory output (a Copy is the common case).
 */
private fun dependentOutputPatterns(task: Task): Set<String> =
    dependentOutputPatternsCache[task]
        ?: computeDependentOutputPatterns(task).also { dependentOutputPatternsCache[task] = it }

private fun computeDependentOutputPatterns(task: Task): Set<String> {
  val extensions = dependencyOutputExtensions(task)
  return when {
    extensions.isNotEmpty() ->
        extensions
            .filterNot { nonInputDependentOutputExtensions.contains(it) }
            .map { "**/*.$it" }
            .toSet()
    declaresDirectoryOutput(task) -> setOf("**/*")
    else -> emptySet()
  }
}

/**
 * Collect dependentTasksOutputFiles patterns for direct dependencies, seeing through opaque
 * lifecycle tasks (e.g. `classes`) to their real producers (e.g. `processResources`). BFS with a
 * visited guard for cycles and diamonds.
 */
private fun effectiveDependencyPatterns(directDeps: Set<Task>): Set<String> {
  val patterns = mutableSetOf<String>()
  val visited = mutableSetOf<Task>()
  val queue = ArrayDeque(directDeps.toList())
  while (queue.isNotEmpty()) {
    val dep = queue.removeFirst()
    if (!visited.add(dep)) continue // cycle / dedup guard
    val depPatterns = dependentOutputPatterns(dep)
    if (depPatterns.isNotEmpty()) {
      // A catch-all subsumes every other pattern, so stop the walk as soon as one appears.
      if ("**/*" in depPatterns) return setOf("**/*")
      patterns.addAll(depPatterns) // real producer -> take its patterns, stop
    } else {
      queue.addAll(getDependsOnTask(dep)) // opaque/lifecycle -> see through, recurse
    }
  }
  return patterns
}

/** Extensions a task's type is known to consume or produce, derived purely from the task class. */
private fun extensionsForTaskType(task: Task): Set<String> =
    when {
      task is GradleTest -> setOf("class", "jar")
      isKotlinCompileTask(task) -> setOf("class", "kotlin_module")
      task is AbstractCompile -> setOf("class")
      else -> emptySet()
    }

/**
 * Declared archive extension(s) for an [AbstractArchiveTask]. Compressed tars also contribute the
 * compression suffix (gz/bz2): the produced file ends in it while `archiveExtension` stays "tar".
 */
private fun declaredArchiveExtensions(task: Task): Set<String> {
  if (task !is AbstractArchiveTask) return emptySet()
  val extensions = mutableSetOf<String>()
  try {
    task.archiveExtension.orNull?.takeIf { it.isNotEmpty() }?.let { extensions.add(it) }
  } catch (e: Exception) {
    task.logger.debug("Could not read archiveExtension for ${task.path}: ${e.message}")
  }
  if (task is Tar) {
    when (task.compression) {
      Compression.GZIP -> extensions.add("gz")
      Compression.BZIP2 -> extensions.add("bz2")
      else -> {}
    }
  }
  return extensions
}

private const val OUTPUT_TYPE_FILE = "FILE"

/**
 * Reflectively read a task's declared output file-property specs, resolving `getFileProperties()`
 * by name+params (its return type relocated between Gradle 8 and 9). Null means the read threw; an
 * empty list means the task declares no outputs.
 */
private fun outputFileProperties(task: Task): List<Any>? =
    try {
      (task.outputs.javaClass.getMethod("getFileProperties").invoke(task.outputs) as? Iterable<*>)
          ?.filterNotNull()
          ?.toList() ?: emptyList()
    } catch (t: Throwable) {
      null
    }

/** Reflectively read an output-property spec's output type name ("FILE" / "DIRECTORY"). */
private fun specOutputTypeName(spec: Any): String? =
    try {
      spec.javaClass.getMethod("getOutputType").invoke(spec)?.toString()
    } catch (t: Throwable) {
      null
    }

/** Reflectively read an output-property spec's declared files. */
private fun specPropertyFiles(spec: Any): org.gradle.api.file.FileCollection? =
    try {
      spec.javaClass.getMethod("getPropertyFiles").invoke(spec)
          as? org.gradle.api.file.FileCollection
    } catch (t: Throwable) {
      null
    }

/** Extensions of a task's declared FILE outputs, read from the declared paths (not disk). */
private fun declaredFileOutputExtensions(task: Task): Set<String> {
  val specs = outputFileProperties(task) ?: return emptySet()
  val extensions = mutableSetOf<String>()
  specs.forEach { spec ->
    if (specOutputTypeName(spec) == OUTPUT_TYPE_FILE) {
      specPropertyFiles(spec)?.files?.forEach { file ->
        if (file.extension.isNotEmpty()) extensions.add(file.extension)
      }
    }
  }
  return extensions
}

/**
 * True if the task declares a non-file output, or its output model couldn't be read (fail open:
 * over-declare the catch-all rather than silently under-declare into a stale cache).
 */
private fun declaresDirectoryOutput(task: Task): Boolean {
  val specs = outputFileProperties(task)
  if (specs == null) {
    task.logger.warn(
        "nx(gradle): could not read declared output properties for ${task.path} " +
            "(Gradle ${task.project.gradle.gradleVersion}); over-declaring its inputs as **/* to " +
            "avoid a stale cache.")
    return true
  }
  return specs.any { specOutputTypeName(it) != OUTPUT_TYPE_FILE }
}

/**
 * Extensions of a copy task's declared concrete-file `from(...)` sources, read from the raw
 * arguments without resolving them. Only gitignored (generated) sources contribute: checked-in
 * sources are already direct inputs.
 */
private fun declaredCopySourceExtensions(
    task: Task,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<String> {
  if (task !is AbstractCopyTask) return emptySet()
  val extensions = mutableSetOf<String>()
  try {
    // getRootSpec() returns an internal type that moved between Gradle 8 and 9; resolve by name.
    val rootSpec = task.javaClass.getMethod("getRootSpec").invoke(task)
    if (rootSpec != null) {
      collectCopySourceExtensions(rootSpec, extensions, gitIgnoreClassifier)
    }
  } catch (t: Throwable) {
    task.logger.debug("Could not read copy source paths for ${task.path}: ${t.message}")
  }
  return extensions
}

private fun collectCopySourceExtensions(
    spec: Any,
    into: MutableSet<String>,
    gitIgnoreClassifier: GitIgnoreClassifier
) {
  // DefaultCopySpec.getSourcePaths() holds the raw from(...) arguments. Absent (null) on specs that
  // do not expose it -> nothing to read at this level.
  val sourcePaths =
      try {
        spec.javaClass.getMethod("getSourcePaths").invoke(spec) as? Iterable<*>
      } catch (t: Throwable) {
        null
      }
  sourcePaths?.forEach { source ->
    try {
      val file = fileFromDeclaredSource(source) ?: return@forEach
      if (gitIgnoreClassifier.isIgnored(file)) {
        file.extension.takeIf { it.isNotEmpty() }?.let { into.add(it) }
      }
    } catch (t: Throwable) {}
  }

  val children =
      try {
        spec.javaClass.getMethod("getChildren").invoke(spec) as? Iterable<*>
      } catch (t: Throwable) {
        null
      }
  children?.filterNotNull()?.forEach { child ->
    collectCopySourceExtensions(child, into, gitIgnoreClassifier)
  }
}

/**
 * Convert a declared `from(...)` argument into a concrete [File] without touching disk, unwrapping
 * lazy forms ([FileSystemLocation], [Provider]). Null for types that would require enumerating the
 * working tree (FileTree, FileCollection, task output).
 */
private fun fileFromDeclaredSource(source: Any?): File? =
    when (source) {
      is File -> source
      is java.nio.file.Path -> source.toFile()
      is CharSequence -> File(source.toString())
      is FileSystemLocation -> source.asFile
      is Provider<*> -> fileFromDeclaredSource(source.orNull)
      else -> null
    }

/**
 * Declared `from(...)` sources of a copy task that are committed directories; these become globs so
 * files added later are picked up without recomputing the graph. Gitignored dirs are excluded:
 * their existence depends on build state.
 */
private fun declaredCopySourceDirs(
    task: Task,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<File> {
  if (task !is AbstractCopyTask) return emptySet()
  val dirs = mutableSetOf<File>()
  try {
    val rootSpec = task.javaClass.getMethod("getRootSpec").invoke(task)
    if (rootSpec != null) {
      collectCopySourceDirs(rootSpec, task, dirs, gitIgnoreClassifier)
    }
  } catch (t: Throwable) {
    task.logger.debug("Could not read copy source dirs for ${task.path}: ${t.message}")
  }
  return dirs
}

private fun collectCopySourceDirs(
    spec: Any,
    task: Task,
    into: MutableSet<File>,
    gitIgnoreClassifier: GitIgnoreClassifier
) {
  fun addCommittedDir(dir: File) {
    val resolved = if (dir.isAbsolute) dir else File(task.project.projectDir, dir.path)
    // A committed dir exists identically on a clean and a built tree, so this stat is
    // deterministic.
    if (!gitIgnoreClassifier.isIgnored(resolved) && resolved.isDirectory) {
      into.add(resolved)
    }
  }
  val sourcePaths =
      try {
        spec.javaClass.getMethod("getSourcePaths").invoke(spec) as? Iterable<*>
      } catch (t: Throwable) {
        null
      }
  sourcePaths?.forEach { source ->
    try {
      when (source) {
        is org.gradle.api.file.SourceDirectorySet -> source.srcDirs.forEach { addCommittedDir(it) }
        else -> fileFromDeclaredSource(source)?.let { addCommittedDir(it) }
      }
    } catch (t: Throwable) {}
  }
  val children =
      try {
        spec.javaClass.getMethod("getChildren").invoke(spec) as? Iterable<*>
      } catch (t: Throwable) {
        null
      }
  children?.filterNotNull()?.forEach { child ->
    collectCopySourceDirs(child, task, into, gitIgnoreClassifier)
  }
}

/** Source roots that may feed this task: every source set's srcDirs, from the public API. */
private fun candidateSourceRoots(task: Task): Set<File> {
  val roots = mutableSetOf<File>()
  try {
    val sourceSets =
        task.project.extensions.findByName("sourceSets") as? org.gradle.api.tasks.SourceSetContainer
    sourceSets?.forEach { sourceSet ->
      roots.addAll(sourceSet.allSource.srcDirs)
      ((sourceSet as? org.gradle.api.plugins.ExtensionAware)?.extensions?.findByName("kotlin")
              as? org.gradle.api.file.SourceDirectorySet)
          ?.let { roots.addAll(it.srcDirs) }
    }
  } catch (t: Throwable) {
    task.logger.debug("Could not read source sets for ${task.path}: ${t.message}")
  }
  return roots
}

/**
 * Parse task and get inputs for this task
 *
 * @param dependsOnTasks set of tasks this task depends on
 * @param task task to process
 * @param projectRoot the project root path
 * @param workspaceRoot the workspace root path
 * @param externalNodes map of external nodes
 * @param gitIgnoreClassifier classifier to determine if files match gitignore patterns
 * @return a list of inputs including external dependencies, null if empty or an error occurred
 */
fun getInputsForTask(
    dependsOnTasks: Set<Task>?,
    task: Task,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>? = null,
    gitIgnoreClassifier: GitIgnoreClassifier
): List<Any>? =
    NxTracing.withSpan("getInputsForTask", mapOf("task" to task.path)) {
      getInputsForTaskImpl(
          dependsOnTasks, task, projectRoot, workspaceRoot, externalNodes, gitIgnoreClassifier)
    }

private fun getInputsForTaskImpl(
    dependsOnTasks: Set<Task>?,
    task: Task,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>? = null,
    gitIgnoreClassifier: GitIgnoreClassifier
): List<Any>? {
  return try {
    val inputs = mutableListOf<Any>()
    val externalDependencies = mutableListOf<String>()

    inputs.addAll(getGradleFilesInputs(workspaceRoot))

    val tasksToProcess = dependsOnTasks ?: getDependsOnTask(task)

    // Files under a known source root collapse into a `root/**/*` glob so files added later
    // invalidate the cache without recomputing the graph (a per-file listing is frozen at
    // graph-computation time).
    val copySourceDirs = declaredCopySourceDirs(task, gitIgnoreClassifier)
    val sourceRoots = candidateSourceRoots(task) + copySourceDirs
    // A declared copy source dir globs even when it contributed no file yet.
    val usedRoots = copySourceDirs.toMutableSet()
    task.inputs.files.forEach { inputFile ->
      val relativePath = replaceRootInPath(inputFile.path, projectRoot, workspaceRoot)

      when {
        // File is outside workspace - treat as external dependency
        relativePath == null -> {
          try {
            val externalDep =
                getExternalDepFromInputFile(inputFile.path, externalNodes, task.logger)
            externalDep?.let { externalDependencies.add(it) }
          } catch (e: Exception) {
            task.logger.info("Error resolving external dependency for ${inputFile.path}: $e")
          }
        }

        // Gitignored - a build artifact, recovered from the task model, not the working tree
        gitIgnoreClassifier.isIgnored(inputFile) -> {}

        // File inside a source root - covered by the root's glob
        else -> {
          val root = sourceRoots.firstOrNull { inputFile.path.startsWith(it.path + File.separator) }
          if (root != null) {
            usedRoots.add(root)
          } else {
            inputs.add(relativePath)
          }
        }
      }
    }
    usedRoots.forEach { root ->
      replaceRootInPath(root.path, projectRoot, workspaceRoot)?.let { inputs.add("$it/**/*") }
    }

    // The task's own patterns: its type plus, for a Copy/Sync, its declared generated sources
    // (e.g. processResources bundling a generated dist/*.tar.gz gains **/*.gz on itself). Not
    // routed through dependencyOutputExtensions so a task gains no self-input from its own outputs.
    val taskOwnPatterns =
        (extensionsForTaskType(task) + declaredCopySourceExtensions(task, gitIgnoreClassifier))
            .filterNot { nonInputDependentOutputExtensions.contains(it) }
            .map { "**/*.$it" }

    // Fail open for what screening or resolution lost: over-declaring costs a rebuild,
    // under-declaring a stale hit.
    val recoveredPathDeps =
        if (skipTaskDependencyResolution || resolveDependsOn(task).unresolved > 0) setOf("**/*")
        else emptySet()

    val dependentPatterns =
        (taskOwnPatterns + effectiveDependencyPatterns(tasksToProcess) + recoveredPathDeps).toSet()
    // The catch-all subsumes every specific glob, so when present emit only it.
    val emittedPatterns = if ("**/*" in dependentPatterns) setOf("**/*") else dependentPatterns
    emittedPatterns.forEach { pattern ->
      inputs.add(mapOf("dependentTasksOutputFiles" to pattern, "transitive" to true))
    }

    if (externalDependencies.isNotEmpty()) {
      inputs.add(mapOf("externalDependencies" to externalDependencies))
    }

    inputs.ifEmpty { null }
  } catch (e: Throwable) {
    task.logger.info("Error getting inputs for ${task.path}: ${e.message}")
    task.logger.debug("Stack trace:", e)
    null
  }
}

/**
 * Get outputs for task
 *
 * @param task task to process
 * @param projectRoot the project root path
 * @param workspaceRoot the workspace root path
 * @return list of output files, will not include if output file is outside workspace, null if empty
 *   or an error occurred
 */
fun getOutputsForTask(task: Task, projectRoot: String, workspaceRoot: String): List<String>? {
  return try {
    val outputs = task.outputs.files
    if (!outputs.isEmpty) {
      return outputs.mapNotNull { file ->
        val path: String = file.path
        replaceRootInPath(path, projectRoot, workspaceRoot)
      }
    }
    null
  } catch (e: Exception) {
    task.logger.info("Error getting outputs for ${task.path}: ${e.message}")
    task.logger.debug("Stack trace:", e)
    null
  }
}

fun getDependsOnTask(task: Task): Set<Task> =
    dependsOnTaskCache[task] ?: computeDependsOnTask(task).also { dependsOnTaskCache[task] = it }

private fun computeDependsOnTask(task: Task): Set<Task> {
  return try {
    val dependsOnFromProperty: Set<Task> =
        try {
          flattenDependsOn(task).filterIsInstance<Task>().toSet()
        } catch (e: Exception) {
          task.logger.info(
              "Cannot access task.dependsOn for ${task.path}, possibly due to configuration cache: ${e.message}")
          emptySet()
        }

    val dependsOnFromTaskDependencies: Set<Task> =
        if (skipTaskDependencyResolution) emptySet() else resolveDependsOn(task).tasks

    val combinedDependsOn = dependsOnFromTaskDependencies.union(dependsOnFromProperty)

    task.logger.info("Dependencies for ${task.path}: ${combinedDependsOn.map { it.path }}")

    combinedDependsOn
  } catch (e: Exception) {
    task.logger.info("Unexpected error getting dependencies for ${task.path}: ${e.message}")
    emptySet()
  }
}

/**
 * Get dependsOn for task, handling configuration timing safely. Rewrites dependency task names
 * based on targetNameOverrides (e.g., test -> ci) and applies targetNamePrefix.
 *
 * @param task task to process
 * @param dependencies optional set to collect inter-project Dependency objects
 * @param targetNameOverrides optional map of overrides (e.g., test -> ci)
 * @param targetNamePrefix optional prefix to apply to all target names
 * @return list of dependsOn task names (possibly replaced), or null if none found or error occurred
 */
// Add a thread-local cache to prevent infinite recursion in dependency resolution
internal val taskDependencyCache =
    ThreadLocal.withInitial { mutableMapOf<String, List<DependsOnEntry>?>() }

fun getDependsOnForTask(
    dependsOnTasks: Set<Task>?,
    task: Task,
    dependencies: MutableSet<Dependency>? = null,
    targetNameOverrides: Map<String, String> = emptyMap(),
    targetNamePrefix: String = ""
): List<DependsOnEntry>? {

  // Check cache to prevent infinite recursion, but only if dependsOnTasks is null
  // When dependsOnTasks is provided, we should not use cache since dependencies might be different
  val cache = taskDependencyCache.get()
  // task.path collides across included builds; the build-tree path does not.
  val taskKey = "${getNxProjectName(task.project)}:${task.name}"
  if (dependsOnTasks == null && cache.containsKey(taskKey)) {
    task.logger.debug("Returning cached dependencies for ${task.path}")
    return cache[taskKey]
  }

  fun mapTasksToObjects(tasks: Collection<Task>): List<DependsOnEntry> {
    val taskProject = task.project
    val sameProjectDependsOn = mutableListOf<DependsOnEntry>()
    val crossProjectByTarget = mutableMapOf<String, MutableList<String>>()

    // A project configured from an ancestor build file owns no build file of its own, but is still
    // a real project — attribute its edges to whichever file configures it.
    val taskProjectBuildFile = effectiveBuildFile(taskProject)

    tasks.distinct().forEach { depTask ->
      val depProject = depTask.project

      if (task.name != "buildDependents" &&
          depProject != taskProject &&
          dependencies != null &&
          taskProjectBuildFile != null) {
        dependencies.add(
            Dependency(
                taskProject.projectDir.path, depProject.projectDir.path, taskProjectBuildFile.path))
      }

      if (effectiveBuildFile(depProject) != null) {
        val targetName = resolveTargetName(depTask, targetNameOverrides, targetNamePrefix)
        if (depProject == taskProject) {
          sameProjectDependsOn.add(DependsOnEntry(target = targetName))
        } else {
          crossProjectByTarget
              .getOrPut(targetName) { mutableListOf() }
              .add(getNxProjectName(depProject))
        }
      }
    }

    val crossProjectDependsOn =
        crossProjectByTarget.map { (targetName, projects) ->
          DependsOnEntry(target = targetName, projects = projects.distinct())
        }

    return sameProjectDependsOn + crossProjectDependsOn
  }

  // Add a placeholder to prevent infinite recursion only when not using pre-computed dependencies
  if (dependsOnTasks == null) {
    try {
      cache[taskKey] = null
      val result = mapTasksToObjects(getDependsOnTask(task)).ifEmpty { null }
      cache[taskKey] = result
      return result
    } catch (e: Exception) {
      task.logger.info("Unexpected error getting dependencies for ${task.path}: ${e.message}")
      task.logger.debug("Stack trace:", e)
      return null
    } finally {
      // Ensure null placeholder is removed if computation failed and result wasn't cached
      if (cache[taskKey] == null) {
        cache.remove(taskKey)
      }
    }
  } else {
    return try {
      mapTasksToObjects(dependsOnTasks).ifEmpty { null }
    } catch (e: Exception) {
      task.logger.info("Unexpected error getting dependencies for ${task.path}: ${e.message}")
      task.logger.debug("Stack trace:", e)
      null
    }
  }
}

/**
 * Get metadata for task
 *
 * @param description task description
 * @param projectBuildPath project build path
 * @param helpTaskName help task name
 * @param nonAtomizedTarget non-atomized target name
 */
fun getMetadata(
    description: String?,
    projectBuildPath: String,
    helpTaskName: String,
    nonAtomizedTarget: String? = null
): Map<String, Any?> {
  val gradlewCommand = getGradlewCommand()
  return mapOf(
      "description" to description,
      "technologies" to arrayOf("gradle"),
      "help" to
          mapOf("command" to "$gradlewCommand help --task ${projectBuildPath}:${helpTaskName}"),
      "nonAtomizedTarget" to nonAtomizedTarget)
}

/**
 * Converts a file path like:
 * org.apache.commons/commons-lang3/3.13.0/b7263237aa89c1f99b327197c41d0669707a462e/commons-lang3-3.13.0.jar
 *
 * Into an external dependency with key: "gradle:commons-lang3-3.13.0" with value: { "type":
 * "gradle", "name": "commons-lang3", "data": { "version": "3.13.0", "packageName":
 * "org.apache.commons.commons-lang3", "hash": "b7263237aa89c1f99b327197c41d0669707a462e",} }
 */
fun getExternalDepFromInputFile(
    inputFile: String,
    externalNodes: MutableMap<String, ExternalNode>?,
    logger: org.gradle.api.logging.Logger
): String? {
  try {
    val segments = inputFile.split("/", "\\")

    if (segments.size < 5) {
      logger.warn("Invalid input path: '$inputFile'. Expected at least 5 segments.")
      return null
    }

    val fileName = segments.last()
    val nameKey = fileName.substringBeforeLast(".", fileName)
    val hash = segments[segments.size - 2]
    val version = segments[segments.size - 3]
    val packageName = segments[segments.size - 4]
    val packageGroup = segments[segments.size - 5]

    val fullPackageName = "$packageGroup.$packageName"
    val data = ExternalDepData(version, fullPackageName, hash)
    val externalKey = "gradle:$nameKey"
    val node = ExternalNode("gradle", externalKey, data)

    if (externalNodes != null) {
      externalNodes[externalKey] = node
    }

    return externalKey
  } catch (e: Exception) {
    logger.warn("Failed to parse inputFile '$inputFile': ${e.message}")
    logger.debug("Stack trace:", e)
    return null
  }
}

/**
 * Replace the projectRoot with {projectRoot} and workspaceRoot with {workspaceRoot}
 *
 * @param path the path to process
 * @param projectRoot the project root path
 * @param workspaceRoot the workspace root path
 * @return mapped path if inside workspace, null if outside workspace
 */
fun replaceRootInPath(path: String, projectRoot: String, workspaceRoot: String): String? {
  return when {
    path.startsWith(projectRoot + File.separator) -> path.replaceFirst(projectRoot, "{projectRoot}")
    path == projectRoot -> "{projectRoot}"
    path.startsWith(workspaceRoot + File.separator) ->
        path.replaceFirst(workspaceRoot, "{workspaceRoot}")

    path == workspaceRoot -> "{workspaceRoot}"
    else -> null
  }
}

private val continuousTasks = setOf("bootRun")

fun isContinuous(task: Task): Boolean {
  return continuousTasks.contains(task.name)
}

private val nonCacheableTasks = setOf("bootRun", "run")

fun isCacheable(task: Task): Boolean {
  // *ToMavenLocal tasks write to ~/.m2 (outside the workspace) — a cache hit skips the real publish
  if (task.name.endsWith("ToMavenLocal")) return false
  return !nonCacheableTasks.contains(task.name)
}

// Compiler incremental-compilation state (*.bin) — non-deterministic and not consumed downstream.
private val nonInputDependentOutputExtensions = setOf("bin")

fun findProviderBasedDependencies(task: Task): Set<String> {
  val taskInternal = task as? TaskInternal ?: return emptySet()

  val result =
      try {
        collectLifecycleDependencies(taskInternal) + collectInputPropertyDependencies(taskInternal)
      } catch (e: Exception) {
        task.logger.debug("Could not analyze provider dependencies for ${task.path}: ${e.message}")
        emptySet()
      }

  if (result.isNotEmpty()) {
    task.logger.info("Task ${task.path} has provider-based dependencies: $result")
  }

  return result
}

private fun collectLifecycleDependencies(task: TaskInternal): Set<String> {
  val lifecycleDeps = task.lifecycleDependencies as? DefaultTaskDependency ?: return emptySet()
  val result = mutableSetOf<String>()

  for (dep in lifecycleDeps.mutableValues) {
    try {
      when (dep) {
        is ProviderInternal<*> -> {
          val producer = dep.producer
          if (producer.isKnown) {
            producer.visitProducerTasks(Action { result.add(it.path) })
          }
        }
        is TaskProvider<*> -> result.add(dep.name)
      }
    } catch (e: Exception) {
      task.logger.debug("Could not resolve lifecycle dependency: ${e.message}")
    }
  }

  return result
}

private fun collectInputPropertyDependencies(task: TaskInternal): Set<String> {
  val projectInternal =
      task.project as? org.gradle.api.internal.project.ProjectInternal ?: return emptySet()
  val propertyWalker =
      projectInternal.services.get(org.gradle.internal.properties.bean.PropertyWalker::class.java)
  val result = mutableSetOf<String>()

  try {
    org.gradle.api.internal.tasks.TaskPropertyUtils.visitProperties(
        propertyWalker,
        task,
        object : org.gradle.internal.properties.PropertyVisitor {
          override fun visitInputProperty(
              name: String,
              value: org.gradle.internal.properties.PropertyValue,
              optional: Boolean
          ) {
            try {
              val deps = value.taskDependencies
              if (deps !is TransformBackedProvider<*, *>) return

              val wrapper = DefaultTaskDependency()
              wrapper.add(deps)
              for (dep in wrapper.getDependencies(task)) {
                result.add(dep.path)
              }
            } catch (_: Exception) {}
          }
        })
  } catch (e: Exception) {
    task.logger.debug(
        "Could not analyze @Input provider dependencies for ${task.path}: ${e.message}")
  }

  return result
}
