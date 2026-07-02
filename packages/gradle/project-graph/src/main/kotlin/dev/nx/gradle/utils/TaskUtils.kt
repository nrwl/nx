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
import org.gradle.api.internal.file.copy.CopySpecInternal
import org.gradle.api.internal.file.copy.DefaultCopySpec
import org.gradle.api.internal.provider.ProviderInternal
import org.gradle.api.internal.provider.TransformBackedProvider
import org.gradle.api.internal.tasks.DefaultTaskDependency
import org.gradle.api.internal.tasks.DefaultTaskOutputs
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.AbstractCopyTask
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.bundling.AbstractArchiveTask
import org.gradle.api.tasks.bundling.Compression
import org.gradle.api.tasks.bundling.Tar
import org.gradle.api.tasks.compile.AbstractCompile
import org.gradle.api.tasks.testing.Test as GradleTest
import org.gradle.internal.file.TreeType

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
 * Test tasks consume .class + .jar (compiled code and library jars on the test classpath). Compile
 * tasks consume .class (Kotlin also emits .kotlin_module) from upstream compile tasks. Archive
 * dependents contribute their declared archive extension (jar, war, tar, and gz/bz2 for compressed
 * tars). Any dependent that declares concrete FILE outputs contributes those files' extensions.
 *
 * A Copy/Sync/ProcessResources task declares its outputs as a directory (no inner extensions), but
 * it also declares its sources via `from(...)` and is pass-through, so its declared concrete-file
 * source extensions equal its effective output extensions. Those declared source paths are read
 * without touching disk (see [declaredCopySourceExtensions]).
 *
 * Directory outputs and non-file sources (FileTrees, providers, task outputs) are intentionally NOT
 * expanded: the task model does not declare which file extensions land inside them, and scanning
 * would reintroduce a dependency on transient on-disk state. Producers whose artifacts must
 * invalidate consumers should declare file outputs (or wire `from(task)` delegation) so their
 * extensions are visible here.
 */
fun inferExtensionsFromInputProperties(
    task: Task,
    dependentTasks: Set<Task>,
    gitIgnoreClassifier: GitIgnoreClassifier
): Set<String> =
    collectDependentOutputExtensions(task, dependentTasks, gitIgnoreClassifier).extensions

/**
 * Result of characterizing a task's dependency outputs: the per-extension globs to emit, plus
 * whether a catch-all is required because some dependency's outputs could not be reduced to
 * extensions.
 */
data class DependentOutputExtensions(val extensions: Set<String>, val needsCatchAll: Boolean)

/**
 * Characterize the outputs of a task's dependencies from the Gradle task model, deciding per
 * dependency whether it can be reduced to concrete extensions or needs a conservative catch-all.
 *
 * For each dependency we union [extensionsForTaskType], [declaredArchiveExtensions],
 * [declaredFileOutputExtensions] and [declaredCopySourceExtensions]. If that yields extensions we
 * contribute them; if it yields nothing but the dependency declares a DIRECTORY output whose
 * contents we cannot characterize, we flag a catch-all. A dependency that declares NO outputs is
 * left alone — a `dependentTasksOutputFiles` glob is matched within a dependency's declared
 * outputs, so there is nothing for a catch-all to match.
 *
 * The consuming task's own type and pass-through copy sources also contribute extensions (matched
 * against dependency outputs), but never trigger a catch-all — the catch-all is strictly about
 * dependency outputs.
 */
fun collectDependentOutputExtensions(
    task: Task,
    dependentTasks: Set<Task>,
    gitIgnoreClassifier: GitIgnoreClassifier
): DependentOutputExtensions {
  val extensions = mutableSetOf<String>()
  var needsCatchAll = false

  // Extensions implied by this task's own type (what it consumes from upstream) and, for a
  // pass-through Copy/Sync task, its declared concrete-file sources (what it forwards downstream
  // even when the producer that generated them declares no outputs).
  extensions.addAll(extensionsForTaskType(task))
  extensions.addAll(declaredCopySourceExtensions(task, gitIgnoreClassifier))

  dependentTasks.forEach { depTask ->
    val depExtensions = mutableSetOf<String>()
    depExtensions.addAll(extensionsForTaskType(depTask))
    depExtensions.addAll(declaredArchiveExtensions(depTask))
    depExtensions.addAll(declaredFileOutputExtensions(depTask))
    depExtensions.addAll(declaredCopySourceExtensions(depTask, gitIgnoreClassifier))

    if (depExtensions.isNotEmpty()) {
      extensions.addAll(depExtensions)
    } else if (declaresDirectoryOutput(depTask)) {
      // Uncharacterizable: a directory output whose file extensions the task model does not
      // declare (e.g. a Copy whose only source is a FileTree, or an opaque custom task with just
      // an @OutputDirectory). Fall back to "**/*" so this dependency's outputs are still hashed.
      // Known limitation: a MIXED Copy (concrete source + FileTree source) is characterized by its
      // concrete part and will NOT get a catch-all, so the FileTree part is under-covered. Rare.
      needsCatchAll = true
    }
  }

  return DependentOutputExtensions(extensions.toSet(), needsCatchAll)
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
 * Extensions of a task's declared FILE outputs, read from the task model. Only FILE-type outputs
 * are considered: the model declares their concrete paths (available even before the files exist),
 * whereas DIRECTORY outputs declare no inner extensions and are skipped on purpose to avoid
 * depending on transient on-disk state.
 */
private fun declaredFileOutputExtensions(task: Task): Set<String> {
  val extensions = mutableSetOf<String>()
  try {
    val outputs = task.outputs as? DefaultTaskOutputs ?: return emptySet()
    outputs.fileProperties.forEach { spec ->
      if (spec.outputType == TreeType.FILE) {
        spec.propertyFiles.forEach { file ->
          val extension = file.extension
          if (extension.isNotEmpty()) {
            extensions.add(extension)
          }
        }
      }
    }
  } catch (e: Exception) {
    task.logger.debug("Could not read declared file outputs for ${task.path}: ${e.message}")
  }
  return extensions
}

/** True if the task declares at least one DIRECTORY output in the task model. */
private fun declaresDirectoryOutput(task: Task): Boolean {
  return try {
    val outputs = task.outputs as? DefaultTaskOutputs ?: return false
    outputs.fileProperties.any { it.outputType == TreeType.DIRECTORY }
  } catch (e: Exception) {
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
    collectCopySourceExtensions(task.rootSpec, extensions, gitIgnoreClassifier)
  } catch (e: Exception) {
    task.logger.debug("Could not read copy source paths for ${task.path}: ${e.message}")
  }
  return extensions
}

/**
 * Recursively collect declared concrete-file source extensions from a copy spec and its children,
 * limited to non-checked-in (gitignored/generated) sources.
 */
private fun collectCopySourceExtensions(
    spec: CopySpecInternal,
    into: MutableSet<String>,
    gitIgnoreClassifier: GitIgnoreClassifier
) {
  if (spec is DefaultCopySpec) {
    spec.sourcePaths.forEach { source ->
      try {
        val file = fileFromDeclaredSource(source) ?: return@forEach
        // Only generated (gitignored) sources need a dependentTasksOutputFiles glob; checked-in
        // sources are already emitted as direct inputs. isIgnored is a pattern match and does not
        // require the file to exist.
        if (gitIgnoreClassifier.isIgnored(file)) {
          file.extension.takeIf { it.isNotEmpty() }?.let { into.add(it) }
        }
      } catch (e: Exception) {
        // Skip any source we cannot classify without touching disk.
      }
    }
  }
  spec.children.forEach { child -> collectCopySourceExtensions(child, into, gitIgnoreClassifier) }
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

    // Characterize dependent-task outputs purely from the Gradle task model (task types and
    // declared archive/file outputs), independent of whether build artifacts exist on disk.
    val dependentOutputs =
        collectDependentOutputExtensions(task, tasksToProcess, gitIgnoreClassifier)

    if (dependentOutputs.needsCatchAll) {
      // At least one dependency has an uncharacterizable directory output. A "**/*" glob is matched
      // within each dependency's declared output dirs (and broadcasts across all of them), so it
      // subsumes the per-extension globs; emit it alone.
      inputs.add(mapOf("dependentTasksOutputFiles" to "**/*", "transitive" to true))
    } else {
      // Consolidate dependent-task outputs into per-extension globs (skip non-deterministic IC
      // state, e.g. compiler *.bin).
      dependentOutputs.extensions
          .filterNot { nonInputDependentOutputExtensions.contains(it) }
          .forEach { extension ->
            inputs.add(
                mapOf("dependentTasksOutputFiles" to "**/*.$extension", "transitive" to true))
          }
    }

    if (externalDependencies.isNotEmpty()) {
      inputs.add(mapOf("externalDependencies" to externalDependencies))
    }

    inputs.ifEmpty { null }
  } catch (e: Exception) {
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
