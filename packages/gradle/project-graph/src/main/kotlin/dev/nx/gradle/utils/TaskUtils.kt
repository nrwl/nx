package dev.nx.gradle.utils

import dev.nx.gradle.NxTaskExtension
import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.DependsOnEntry
import dev.nx.gradle.data.ExternalDepData
import dev.nx.gradle.data.ExternalNode
import java.io.File
import java.util.Collections
import java.util.IdentityHashMap
import java.util.WeakHashMap
import java.util.concurrent.Callable
import kotlin.io.path.Path
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.FileCollection
import org.gradle.api.file.FileSystemLocation
import org.gradle.api.internal.TaskInternal
import org.gradle.api.internal.provider.ProviderInternal
import org.gradle.api.internal.provider.TransformBackedProvider
import org.gradle.api.internal.tasks.DefaultTaskDependency
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.AbstractCopyTask
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.bundling.AbstractArchiveTask
import org.gradle.api.tasks.bundling.Compression
import org.gradle.api.tasks.bundling.Tar
import org.gradle.api.tasks.compile.AbstractCompile
import org.gradle.api.tasks.testing.Test as GradleTest

private val kotlinCompileToolClass: Class<*>? by lazy {
  try {
    Class.forName("org.jetbrains.kotlin.gradle.tasks.AbstractKotlinCompileTool")
  } catch (e: Throwable) {
    null
  }
}

private fun isKotlinCompileTask(task: Task): Boolean =
    kotlinCompileToolClass?.isInstance(task) == true

/**
 * A task's dependencies and its declared output shape are fixed for the life of one build
 * invocation, but [effectiveDependencyPatterns] re-walks the same subtrees once per task — on a
 * large multi-project build that walk dominates report time, because resolving a dependency edge
 * can force configuration resolution in another project.
 *
 * Keyed by [Task] identity, not `task.path`: paths collide across included builds (Kafka has both
 * `:core` and `api-checker`'s `:core`). Weak keys so a long-lived daemon doesn't retain build state
 * between invocations; Gradle holds the tasks strongly for the duration of the build anyway.
 */
private val dependsOnTaskCache: MutableMap<Task, Set<Task>> =
    Collections.synchronizedMap(WeakHashMap())

private val dependentOutputPatternsCache: MutableMap<Task, Set<String>> =
    Collections.synchronizedMap(WeakHashMap())

/**
 * `task.taskDependencies.getDependencies()` resolves dependency *paths* (`:a:b:test`), which sends
 * Gradle back through `ensureProjectsConfigured` — re-entering the configuration phase from a task
 * action. On builds that declare cross-project dependsOn by qualified path (Kafka) that blocks
 * indefinitely on the build-lifecycle state lock. Set to fall back to the raw `dependsOn` property,
 * which is already-resolved Task instances and never triggers configuration.
 */
private val skipTaskDependencyResolution: Boolean =
    System.getenv("NX_GRADLE_SKIP_TASK_DEPS")?.toBoolean() == true

/** A dependency edge as (owning project, task name); building one never realizes the Task. */
internal data class DepRef(val project: Project, val taskName: String)

/**
 * Task paths and names declared in a task's raw `dependsOn`, as plain strings. The qualified ones
 * are what make [org.gradle.api.tasks.TaskDependency.getDependencies] re-enter project
 * configuration; [qualifiedPathDeps] selects those, and [resolvePathDeps] resolves them via
 * [Project.findProject], which returns the already-instantiated project without configuring it.
 */
private fun pathStringDeps(task: Task): List<String> {
  return try {
    val paths = flattenDependsOn(task.dependsOn).filterIsInstance<CharSequence>()
    paths.map { it.toString() }.filter { it.isNotEmpty() }
  } catch (e: Exception) {
    task.logger.info("Cannot read dependsOn paths for ${task.path}: ${e.message}")
    emptyList()
  }
}

/**
 * `dependsOn: [':a:test', ':b:test']` stores the whole list as ONE element of the dependsOn set, so
 * declared paths are invisible to a flat scan. Only List/Set/Array are descended into — a
 * FileCollection is also Iterable, and iterating one would resolve it.
 */
private fun flattenDependsOn(values: Iterable<*>): List<Any> {
  val flattened = mutableListOf<Any>()
  // Gradle's own DefaultTaskDependency.visitDependencies drains an ArrayDeque with no cycle
  // guard, so a self-referential structure loops forever there. Identity semantics rather than
  // equals/hashCode: the elements are arbitrary user objects, and two equal-but-distinct
  // collections are separate work.
  val seen = Collections.newSetFromMap(IdentityHashMap<Any, Boolean>())
  fun visit(value: Any?) {
    when (value) {
      null -> {}
      is List<*> -> if (seen.add(value)) value.forEach(::visit)
      is Set<*> -> if (seen.add(value)) value.forEach(::visit)
      is Array<*> -> if (seen.add(value)) value.forEach(::visit)
      // `dependsOn { … }` stores a Callable. Gradle resolves it by calling it, and so do we —
      // the result is classified with the same rules, so no path reaches Gradle's resolver.
      is Callable<*> ->
          if (seen.add(value)) {
            try {
              visit(value.call())
            } catch (e: Exception) {
              flattened.add(value)
            }
          }
      else -> flattened.add(value)
    }
  }
  values.forEach(::visit)
  return flattened
}

/**
 * Entries the bypass cannot resolve without re-entering project configuration: a [FileCollection]
 * or a raw [org.gradle.api.tasks.TaskDependency] only yields its tasks by resolving, and for a
 * configuration-backed collection that configures the producing project. A task carrying one is
 * reported uncacheable rather than cached against a dependency set we know is short.
 */
private fun hasUnresolvableDeps(task: Task): Boolean =
    try {
      flattenDependsOn(task.dependsOn).any {
        it is FileCollection || it is org.gradle.api.tasks.TaskDependency
      }
    } catch (e: Exception) {
      task.logger.info("Cannot inspect dependsOn for ${task.path}: ${e.message}")
      false
    }

/**
 * Only *qualified* paths need path-based recovery. A bare name (`classes`) resolves inside the
 * declaring project and never reaches the build-scoped resolver, so leaving those to
 * [org.gradle.api.tasks.TaskDependency] keeps full fidelity — notably letting
 * [effectiveDependencyPatterns] see through lifecycle tasks.
 */
private fun qualifiedPathDeps(task: Task): List<String> =
    pathStringDeps(task).filter { it.contains(':') }

/**
 * True when [computeDependsOnTask] must not call [org.gradle.api.tasks.TaskDependency]. Both call
 * sites share this: the inputs derivation fails open on exactly the tasks whose dependency walk was
 * suppressed, so the two must never drift apart.
 */
private fun bypassesTaskDependencies(task: Task): Boolean =
    skipTaskDependencyResolution || qualifiedPathDeps(task).isNotEmpty()

/**
 * Dependencies the bypass would otherwise drop. A bare name and a [TaskProvider] both resolve
 * inside the declaring project, which is already configured, so neither re-enters
 * `ensureProjectsConfigured` the way a qualified path does.
 */
private fun sameProjectDeps(task: Task): Set<Task> {
  val recovered = mutableSetOf<Task>()
  flattenDependsOn(task.dependsOn).forEach { value ->
    try {
      when {
        value is TaskProvider<*> -> (value.orNull as? Task)?.let { recovered.add(it) }
        value is CharSequence && !value.contains(':') ->
            task.project.tasks.findByName(value.toString())?.let { recovered.add(it) }
        else -> {}
      }
    } catch (e: Exception) {
      task.logger.info("Cannot recover same-project dependsOn for ${task.path}: ${e.message}")
    }
  }
  return recovered
}

/**
 * Split a dependsOn path into its project and task name without realizing either. Handles both
 * absolute (`:a:b:test`) and relative-to-the-declaring-project (`connect:api:jar`) forms.
 */
internal fun resolvePathDeps(task: Task): List<DepRef> =
    qualifiedPathDeps(task).mapNotNull { path ->
      val separator = path.lastIndexOf(':')
      val taskName = path.substring(separator + 1)
      if (taskName.isEmpty()) return@mapNotNull null
      val prefix = path.substring(0, separator)
      val ownerPath = task.project.path
      val projectPath =
          when {
            path.startsWith(":") -> prefix.ifEmpty { ":" }
            ownerPath == ":" -> ":$prefix"
            else -> "$ownerPath:$prefix"
          }
      task.project.rootProject.findProject(projectPath)?.let { DepRef(it, taskName) }
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
  // Caching a target whose dependency set we know is incomplete risks a stale hit, which is worse
  // than not caching it. Only tasks that both bypass and carry unresolvable entries are affected.
  val dependenciesFullyKnown = !(bypassesTaskDependencies(task) && hasUnresolvableDeps(task))
  target["cache"] = isCacheable(task) && dependenciesFullyKnown

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

    // A task whose qualified-path dependsOn was recovered by [resolvePathDeps] has no realized
    // dependency Tasks to walk, so the walk would silently under-declare. Fail open to the
    // catch-all instead: over-declaring costs a rebuild, under-declaring costs a stale cache hit.
    val recoveredPathDeps = if (bypassesTaskDependencies(task)) setOf("**/*") else emptySet()

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
  // Try to safely get dependencies, with fallback for configuration cache issues
  return try {
    // First try to get dependencies from task.dependsOn property
    val dependsOnFromProperty: Set<Task> =
        try {
          flattenDependsOn(task.dependsOn).filterIsInstance<Task>().toSet()
        } catch (e: Exception) {
          task.logger.info(
              "Cannot access task.dependsOn for ${task.path}, possibly due to configuration cache: ${e.message}")
          emptySet()
        }

    // Then try to get dependencies from taskDependencies (more comprehensive but riskier with
    // config cache)
    // Resolving TaskDependency for a task that names dependencies by qualified path re-enters the
    // configuration phase and blocks on the build-lifecycle lock. Those edges are recovered from
    // the path strings instead — see resolvePathDeps.
    val dependsOnFromTaskDependencies: Set<Task> =
        if (bypassesTaskDependencies(task)) sameProjectDeps(task)
        else
            try {
              task.taskDependencies.getDependencies(task)
            } catch (e: UnsupportedOperationException) {
              task.logger.info(
                  "Cannot access taskDependencies for ${task.path} due to configuration cache restrictions")
              emptySet()
            } catch (e: Exception) {
              task.logger.info("Error calling getDependencies for ${task.path}: ${e.message}")
              emptySet()
            }

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
  // Not task.path: it collides across included builds (Kafka has :core in both). The build-tree
  // path is unique, and is what the report already keys projects by.
  val taskKey = "${getNxProjectName(task.project)}:${task.name}"
  if (dependsOnTasks == null && cache.containsKey(taskKey)) {
    task.logger.debug("Returning cached dependencies for ${task.path}")
    return cache[taskKey]
  }

  fun mapTasksToObjects(tasks: Collection<Task>): List<DependsOnEntry> {
    val taskProject = task.project
    val sameProjectDependsOn = mutableListOf<DependsOnEntry>()
    val crossProjectByTarget = mutableMapOf<String, MutableList<String>>()

    // Realized Tasks plus edges recovered from path strings, which never carry a Task instance.
    val depRefs = tasks.map { DepRef(it.project, it.name) } + resolvePathDeps(task).distinct()

    // A project configured from an ancestor build file owns no build file of its own, but is still
    // a real project — attribute its edges to whichever file configures it.
    val taskProjectBuildFile = effectiveBuildFile(taskProject)

    depRefs.distinct().forEach { depRef ->
      val depProject = depRef.project

      if (task.name != "buildDependents" &&
          depProject != taskProject &&
          dependencies != null &&
          taskProjectBuildFile != null) {
        dependencies.add(
            Dependency(
                taskProject.projectDir.path, depProject.projectDir.path, taskProjectBuildFile.path))
      }

      if (effectiveBuildFile(depProject) != null) {
        val targetName = resolveTargetName(depRef.taskName, targetNameOverrides, targetNamePrefix)
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
      // Unconditional: a task may have no realized Task dependencies yet still declare
      // path-string ones, which mapTasksToObjects recovers.
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
