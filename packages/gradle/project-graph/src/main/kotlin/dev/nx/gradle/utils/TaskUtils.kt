package dev.nx.gradle.utils

import dev.nx.gradle.NxTaskExtension
import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.DependsOnEntry
import dev.nx.gradle.data.ExternalDepData
import dev.nx.gradle.data.ExternalNode
import java.io.File
import kotlin.io.path.Path
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.Task
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
 * Derive the file extensions that a task consumes from its dependents' outputs, using ONLY the
 * Gradle task model (task types and declared outputs). This is a pure function of the configured
 * build: it never inspects the working tree, so it yields the same result on a clean checkout and
 * on a fully built one.
 *
 * This is the extension-level view used by unit tests. The production input derivation uses
 * [dependentOutputPatterns], which formats patterns per dependency and falls back to a catch-all
 * for uncharacterizable directory outputs.
 *
 * Test tasks consume .class + .jar (compiled code and library jars on the test classpath). Compile
 * tasks consume .class (Kotlin also emits .kotlin_module) from upstream compile tasks. Archive
 * dependents contribute their declared archive extension (jar, war, tar, and gz/bz2 for compressed
 * tars). Any dependent that declares concrete FILE outputs contributes those files' extensions. A
 * pass-through Copy/Sync task contributes the extensions of its declared concrete-file sources
 * (read without touching disk; see [declaredCopySourceExtensions]).
 */
fun inferExtensionsFromInputProperties(
    task: Task,
    dependentTasks: Set<Task>,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<String> {
  val extensions = mutableSetOf<String>()

  // The consuming task's own type (what it consumes from upstream) and pass-through copy sources.
  // NOTE: the task itself is NOT routed through dependencyOutputExtensions — that would leak its
  // archive/file-output extensions into its own inputs (e.g. a Jar task must not gain a **/*.jar
  // self-input).
  extensions.addAll(extensionsForTaskType(task))
  extensions.addAll(declaredCopySourceExtensions(task, gitIgnoreClassifier))

  // Each dependency's declared output model (dispatched by task kind).
  dependentTasks.forEach { depTask -> extensions.addAll(dependencyOutputExtensions(depTask)) }

  return extensions.toSet()
}

/**
 * Output extensions a DEPENDENCY task produces, dispatched by task kind. A consumer hashes the
 * dependency's OUTPUT, so read declared outputs, not sources. Archives read archiveExtension (plus
 * Tar compression); compile/test are constant per class via [extensionsForTaskType];
 * [declaredFileOutputExtensions] adds any declared OutputFile. A Copy names nothing here; its
 * directory output is covered by [dependentOutputPatterns]'s catch-all (reading sources would miss
 * committed files that enter via a directory source, e.g. a resource copied onto a jar).
 */
private fun dependencyOutputExtensions(task: Task): Set<String> {
  val byKind =
      when {
        task is AbstractArchiveTask -> declaredArchiveExtensions(task)
        else -> extensionsForTaskType(task) // Kotlin/Java compile, Test, else {}
      }
  // Universal baseline: any task may declare concrete FILE outputs beyond its kind.
  return byKind + declaredFileOutputExtensions(task)
}

/**
 * dependentTasksOutputFiles patterns for one dependency, from the task model only (so a clean and a
 * built tree agree). Named extensions from [dependencyOutputExtensions] become per-extension globs
 * (non-input IC extensions filtered out); if none are nameable but the task declares a DIRECTORY
 * output, emit the wildcard catch-all so its outputs are still hashed. A Copy is the common
 * catch-all case.
 */
private fun dependentOutputPatterns(task: Task): Set<String> {
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
 * Collect dependentTasksOutputFiles patterns for a set of direct dependencies, seeing THROUGH
 * opaque lifecycle tasks. A dependency that yields patterns (a real producer: extension globs or a
 * wildcard catch-all for a declared directory output) contributes them and stops. A dependency that
 * yields NO patterns (an opaque aggregator like `classes`, with no declared outputs and no
 * characterizable type) is treated as transparent: we recurse into ITS dependencies. This surfaces
 * producers such as `processResources` that a consumer (`jar`) only reaches transitively via
 * `classes`.
 *
 * BFS with a visited guard so cycles and diamonds are handled and each task is characterized once.
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
      patterns.addAll(depPatterns) // real producer -> take its patterns, stop
    } else {
      queue.addAll(getDependsOnTask(dep)) // opaque/lifecycle -> see through, recurse
    }
  }
  return patterns
}

/**
 * Extensions a task's type is known to consume from (or produce for) upstream tasks, derived purely
 * from the task class. Reuses [isKotlinCompileTask] for Kotlin-compile detection.
 */
private fun extensionsForTaskType(task: Task): Set<String> =
    when {
      task is GradleTest -> setOf("class", "jar")
      isKotlinCompileTask(task) -> setOf("class", "kotlin_module")
      task is AbstractCompile -> setOf("class")
      else -> emptySet()
    }

/**
 * Declared archive extension(s) for an [AbstractArchiveTask] (Jar/Zip/Tar/War/shadowJar), read from
 * the task model without requiring the archive to exist. Compressed tars additionally contribute
 * the compression suffix (gz/bz2), since the produced file ends in that extension even though
 * `archiveExtension` remains "tar".
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

/**
 * Reflectively read a task's declared output file-property specs. The concrete `TaskOutputs`
 * implementation and the return type of `getFileProperties()` relocated/changed between Gradle 8
 * and 9, so we resolve by method name+params (which ignores return type) to work on both. Returns
 * an empty list on any reflection failure.
 */
private fun outputFileProperties(task: Task): List<Any> =
    try {
      (task.outputs.javaClass.getMethod("getFileProperties").invoke(task.outputs) as? Iterable<*>)
          ?.filterNotNull()
          ?.toList() ?: emptyList()
    } catch (t: Throwable) {
      emptyList()
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

/**
 * Extensions of a task's declared FILE outputs, read from the task model via reflection (see
 * [outputFileProperties]). Only FILE-type outputs are considered: the model declares their concrete
 * paths (available even before the files exist), whereas DIRECTORY outputs declare no inner
 * extensions and are skipped on purpose to avoid depending on transient on-disk state.
 */
private fun declaredFileOutputExtensions(task: Task): Set<String> {
  val extensions = mutableSetOf<String>()
  try {
    outputFileProperties(task).forEach { spec ->
      if (specOutputTypeName(spec) == "FILE") {
        specPropertyFiles(spec)?.files?.forEach { file ->
          val extension = file.extension
          if (extension.isNotEmpty()) {
            extensions.add(extension)
          }
        }
      }
    }
  } catch (t: Throwable) {
    task.logger.debug("Could not read declared file outputs for ${task.path}: ${t.message}")
  }
  return extensions
}

/**
 * True if the task declares at least one DIRECTORY output in the task model (read reflectively).
 */
private fun declaresDirectoryOutput(task: Task): Boolean {
  return try {
    outputFileProperties(task).any { specOutputTypeName(it) == "DIRECTORY" }
  } catch (t: Throwable) {
    false
  }
}

/**
 * Extensions declared as concrete-file sources of an [AbstractCopyTask]
 * (Copy/Sync/ProcessResources).
 *
 * A copy task is pass-through, so its declared source extensions equal its effective output
 * extensions. Its outputs are a directory (no inner extensions), so we read the DECLARED source
 * objects from the copy spec tree instead. Only concrete file paths (`File`,
 * `String`/`CharSequence` or `java.nio.file.Path`) are considered; FileTrees, FileCollections,
 * providers and task outputs are skipped, since turning them into extensions would require
 * enumerating the working tree. This is existence-independent: the raw `from(...)` arguments are
 * read, never resolved.
 *
 * Only sources that are NOT checked in (i.e. gitignored/generated build outputs) contribute an
 * extension. `dependentTasksOutputFiles` globs are matched against dependency OUTPUTS, so a
 * checked-in source is already captured as a direct source input by the `task.inputs.files` branch
 * and emitting a glob for it would be redundant and imprecise.
 */
private fun declaredCopySourceExtensions(
    task: Task,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<String> {
  if (task !is AbstractCopyTask) return emptySet()
  val extensions = mutableSetOf<String>()
  try {
    // AbstractCopyTask.getRootSpec() returns a CopySpecInternal (internal type); resolve it
    // reflectively (by name+params) so we do not compile-bind to it — it relocated/changed between
    // Gradle 8 and 9.
    val rootSpec = task.javaClass.getMethod("getRootSpec").invoke(task)
    if (rootSpec != null) {
      collectCopySourceExtensions(rootSpec, extensions, gitIgnoreClassifier)
    }
  } catch (t: Throwable) {
    task.logger.debug("Could not read copy source paths for ${task.path}: ${t.message}")
  }
  return extensions
}

/**
 * Recursively collect declared concrete-file source extensions from a copy spec and its children,
 * limited to non-checked-in (gitignored/generated) sources. The spec is passed as [Any] and its
 * `getSourcePaths()` / `getChildren()` are read reflectively, so we never compile-bind to the
 * internal CopySpecInternal/DefaultCopySpec types (which changed between Gradle 8 and 9).
 */
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
      // Only generated (gitignored) sources need a dependentTasksOutputFiles glob; checked-in
      // sources are already emitted as direct inputs. isIgnored is a pattern match and does not
      // require the file to exist.
      if (gitIgnoreClassifier.isIgnored(file)) {
        file.extension.takeIf { it.isNotEmpty() }?.let { into.add(it) }
      }
    } catch (t: Throwable) {
      // Skip any source we cannot classify without touching disk.
    }
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
 * Convert a declared `from(...)` argument into a concrete [File] when it resolves to a single path
 * we can read without touching disk. Handles the idiomatic lazy forms:
 * - [FileSystemLocation] (RegularFile / Directory), e.g. from a `layout` file
 * - [Provider] (RegularFileProperty / DirectoryProperty / `layout.buildDirectory.file(...)` /
 *   `provider { ... }`), unwrapped ONCE via [Provider.getOrNull] (not `get()`) and recursed
 *
 * Resolution stays config-time: `orNull` on a layout/property provider computes the declared path
 * without the file existing. Returns null for argument types that would require enumerating the
 * working tree (FileTree, FileCollection, task output) or for a provider with no value.
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

    // Classify this task's declared input files into direct source inputs vs external
    // dependencies. Build-artifact extensions are intentionally NOT harvested from the working
    // tree here; they are derived deterministically from the Gradle task model below (see
    // inferExtensionsFromInputProperties). Keeping this independent of on-disk build state ensures
    // two checkouts of the same commit produce the same graph.
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

        // File matches gitignore pattern - it is a build artifact, not a source input. Skip it so
        // it is not added as a direct input; its extension is recovered from the task model, not
        // from the working tree.
        gitIgnoreClassifier.isIgnored(inputFile) -> {}

        // Regular source file - add as direct input
        else -> {
          inputs.add(relativePath)
        }
      }
    }

    // Patterns the TASK ITSELF (the consuming task being characterized) produces/consumes: its own
    // type plus, for a pass-through Copy/Sync, its declared concrete-file sources. These must land
    // in
    // the task's OWN inputs (e.g. processResources bundling a generated dist/*.tar.gz must gain
    // **/*.gz on itself, not only on downstream consumers). The task itself never contributes a
    // catch-all and is deliberately NOT routed through dependencyOutputExtensions (so a Jar/Test
    // task
    // does not gain a self-input from its own archive/file outputs).
    val taskOwnPatterns =
        (extensionsForTaskType(task) + declaredCopySourceExtensions(task, gitIgnoreClassifier))
            .filterNot { nonInputDependentOutputExtensions.contains(it) }
            .map { "**/*.$it" }

    // Characterize the dependency outputs from the Gradle task model (independent of on-disk build
    // state). A "**/*" pattern (for an uncharacterizable directory output) is matched within a
    // dependency's declared output dirs. Opaque lifecycle tasks (e.g. `classes`, which produces no
    // patterns) are seen through to their real producers (e.g. `processResources`). Union with the
    // task-itself patterns, dedupe and emit.
    (taskOwnPatterns + effectiveDependencyPatterns(tasksToProcess)).toSet().forEach { pattern ->
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

fun getDependsOnTask(task: Task): Set<Task> {
  // Try to safely get dependencies, with fallback for configuration cache issues
  return try {
    // First try to get dependencies from task.dependsOn property
    val dependsOnFromProperty: Set<Task> =
        try {
          task.dependsOn.filterIsInstance<Task>().toSet()
        } catch (e: Exception) {
          task.logger.info(
              "Cannot access task.dependsOn for ${task.path}, possibly due to configuration cache: ${e.message}")
          emptySet()
        }

    // Then try to get dependencies from taskDependencies (more comprehensive but riskier with
    // config cache)
    val dependsOnFromTaskDependencies: Set<Task> =
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
  val taskKey = task.path
  if (dependsOnTasks == null && cache.containsKey(taskKey)) {
    task.logger.debug("Returning cached dependencies for ${task.path}")
    return cache[taskKey]
  }

  fun mapTasksToObjects(tasks: Collection<Task>): List<DependsOnEntry> {
    val taskProject = task.project
    val sameProjectDependsOn = mutableListOf<DependsOnEntry>()
    val crossProjectByTarget = mutableMapOf<String, MutableList<String>>()

    tasks.forEach { depTask ->
      val depProject = depTask.project

      if (task.name != "buildDependents" &&
          depProject != taskProject &&
          dependencies != null &&
          taskProject.buildFile.exists()) {
        dependencies.add(
            Dependency(
                taskProject.projectDir.path,
                depProject.projectDir.path,
                taskProject.buildFile.path))
      }

      if (depProject.buildFile.path != null && depProject.buildFile.exists()) {
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
      val combinedDependsOn = getDependsOnTask(task)
      val result =
          if (combinedDependsOn.isNotEmpty()) {
            mapTasksToObjects(combinedDependsOn).ifEmpty { null }
          } else {
            null
          }
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
      val result =
          if (dependsOnTasks.isNotEmpty()) {
            mapTasksToObjects(dependsOnTasks).ifEmpty { null }
          } else {
            null
          }
      result
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
