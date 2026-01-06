package dev.nx.gradle.utils

import dev.nx.gradle.NxTaskExtension
import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.ExternalDepData
import dev.nx.gradle.data.ExternalNode
import java.io.File
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.internal.TaskInternal
import org.gradle.api.internal.provider.ProviderInternal
import org.gradle.api.internal.tasks.DefaultTaskDependency
import org.gradle.api.tasks.TaskProvider

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
): MutableMap<String, Any?> {
  val logger = task.logger
  logger.info("NxProjectReportTask: process $task for $projectRoot")
  val target = mutableMapOf<String, Any?>()
  target["cache"] = isCacheable(task)

  val continuous = isContinuous(task)
  if (continuous) {
    target["continuous"] = true
  }

  // Get combined depends on tasks once and reuse
  val dependsOnTasks = getDependsOnTask(task)

  // process outputs
  val outputs = getOutputsForTask(task, projectRoot, workspaceRoot)
  if (!outputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${outputs.size} outputs")
    target["outputs"] = outputs
  }

  // process dependsOn
  val dependsOn =
      getDependsOnForTask(dependsOnTasks, task, dependencies, targetNameOverrides, targetNamePrefix)

  if (!dependsOn.isNullOrEmpty()) {
    logger.info("${task}: processed ${dependsOn.size} total dependsOn")
    target["dependsOn"] = dependsOn
  }

  // Check for nx extension to get additional config
  val nxExtension = task.extensions.findByType(NxTaskExtension::class.java)

  // Merge nx.json config into target (this allows users to set any Nx target properties)
  nxExtension?.json?.getOrNull()?.let { nxJson -> target["nxConfig"] = nxJson }

  // process inputs
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
    if (hasProviderBasedDependencies(task)) {
      put("excludeDependsOn", false)
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
): List<Any>? {
  return try {
    val inputs = mutableListOf<Any>()
    val externalDependencies = mutableListOf<String>()

    // Collect outputs from dependent tasks
    val tasksToProcess = dependsOnTasks ?: getDependsOnTask(task)
    tasksToProcess.forEach { dependentTask ->
      dependentTask.outputs.files.files.forEach { outputFile ->
        if (isFileInWorkspace(outputFile, workspaceRoot)) {
          val relativePath = toRelativePathOrGlob(outputFile, workspaceRoot)
          inputs.add(mapOf("dependentTasksOutputFiles" to relativePath))
        }
      }
    }

    // Process each tasks's input files from the tooling API
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

        // File matches gitignore pattern - treat as dependentTasksOutputFiles (build artifact)
        gitIgnoreClassifier.isIgnored(inputFile) -> {
          val relativePathOrGlob = toRelativePathOrGlob(inputFile, workspaceRoot)
          inputs.add(mapOf("dependentTasksOutputFiles" to relativePathOrGlob))
        }

        // Regular source file - add as direct input
        else -> {
          inputs.add(relativePath)
        }
      }
    }

    // Step 3: Add external dependencies if any
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

/** Checks if a file is within the workspace. */
private fun isFileInWorkspace(file: File, workspaceRoot: String): Boolean {
  return file.path.startsWith(workspaceRoot + File.separator)
}

/** Converts a file to a relative path. If it's a directory, returns a glob pattern. */
private fun toRelativePathOrGlob(file: File, workspaceRoot: String): String {
  val relativePath = file.path.substring(workspaceRoot.length + 1)
  val isFile = file.name.contains('.') || (file.exists() && file.isFile)

  return if (isFile) {
    relativePath
  } else {
    "$relativePath${File.separator}**${File.separator}*"
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
internal val taskDependencyCache = ThreadLocal.withInitial { mutableMapOf<String, List<String>?>() }

fun getDependsOnForTask(
    dependsOnTasks: Set<Task>?,
    task: Task,
    dependencies: MutableSet<Dependency>? = null,
    targetNameOverrides: Map<String, String> = emptyMap(),
    targetNamePrefix: String = ""
): List<String>? {

  // Helper function to apply prefix to target names
  fun applyPrefix(name: String): String =
      if (targetNamePrefix.isNotEmpty()) "$targetNamePrefix$name" else name

  // Check cache to prevent infinite recursion, but only if dependsOnTasks is null
  // When dependsOnTasks is provided, we should not use cache since dependencies might be different
  val cache = taskDependencyCache.get()
  val taskKey = task.path
  if (dependsOnTasks == null && cache.containsKey(taskKey)) {
    task.logger.debug("Returning cached dependencies for ${task.path}")
    return cache[taskKey]
  }

  fun mapTasksToNames(tasks: Collection<Task>): List<String> {
    return tasks.mapNotNull { depTask ->
      val depProject = depTask.project
      val taskProject = task.project

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
        val taskName =
            applyPrefix(
                if (depTask.name == "test" && targetNameOverrides.containsKey("testTargetName")) {
                  targetNameOverrides["testTargetName"]!!
                } else {
                  depTask.name
                })
        "${depProject.name}:${taskName}"
      } else {
        null
      }
    }
  }

  // Add a placeholder to prevent infinite recursion only when not using pre-computed dependencies
  if (dependsOnTasks == null) {
    try {
      cache[taskKey] = null
      // Compute dependencies
      val combinedDependsOn = getDependsOnTask(task)
      val result =
          if (combinedDependsOn.isNotEmpty()) {
            mapTasksToNames(combinedDependsOn)
          } else {
            null
          }
      // Cache the actual result before returning
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
    // When using pre-computed dependencies, don't use cache
    return try {
      val result =
          if (dependsOnTasks.isNotEmpty()) {
            mapTasksToNames(dependsOnTasks)
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
 *
 * @param inputFile Path to the dependency jar.
 * @param externalNodes Map to populate with the resulting ExternalNode.
 * @param logger Gradle logger for warnings and debug info
 * @return The external dependency key (e.g., gradle:commons-lang3-3.13.0), or null if parsing
 *   fails.
 */
fun getExternalDepFromInputFile(
    inputFile: String,
    externalNodes: MutableMap<String, ExternalNode>?,
    logger: org.gradle.api.logging.Logger
): String? {
  try {
    val segments = inputFile.split("/")

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
  return !nonCacheableTasks.contains(task.name)
}

/**
 * Finds provider-based task dependencies by inspecting lifecycle dependencies without triggering
 * resolution. Uses Gradle internal APIs to access raw dependency values and check for providers
 * with known producer tasks.
 *
 * These are the dependencies that will cause "Querying the mapped value of flatmap(...) before
 * task has completed" errors when the provider value is queried before the producing task completes.
 *
 * @param task the task to analyze
 * @param project the project containing the task (unused but kept for API compatibility)
 * @return set of task paths that are provider-based dependencies with known producers
 */
fun findProviderBasedDependencies(task: Task): Set<String> {
  val logger = task.logger
  val producerTasks = mutableSetOf<String>()

  try {
    val taskInternal = task as? TaskInternal ?: return emptySet()
    val lifecycleDeps = taskInternal.lifecycleDependencies

    if (lifecycleDeps is DefaultTaskDependency) {
      // Access raw unresolved values without triggering resolution
      val rawDeps: Set<Any> = lifecycleDeps.mutableValues

      rawDeps.forEach { dep ->
        when (dep) {
          is ProviderInternal<*> -> {
            try {
              val producer = dep.producer
              if (producer.isKnown) {
                producer.visitProducerTasks(
                    Action { producerTask -> producerTasks.add(producerTask.path) })
              }
            } catch (e: Exception) {
              logger.debug("Could not get producer from provider: ${e.message}")
            }
          }
          is TaskProvider<*> -> {
            // TaskProvider itself indicates a lazy task dependency
            try {
              // Don't resolve the provider, just note that there's a provider-based dependency
              // We can get the name without fully resolving
              producerTasks.add(dep.name)
            } catch (e: Exception) {
              logger.debug("Could not get name from TaskProvider: ${e.message}")
            }
          }
        }
      }
    }

    if (producerTasks.isNotEmpty()) {
      logger.info("Task ${task.path} has provider-based dependencies: $producerTasks")
    }
  } catch (e: Exception) {
    logger.debug("Could not analyze provider dependencies for ${task.path}: ${e.message}")
  }

  return producerTasks
}

/**
 * Checks if a task has any provider-based dependencies with known producer tasks.
 *
 * @param task the task to check
 * @param project the project containing the task
 * @return true if the task has provider-based dependencies, false otherwise
 */
fun hasProviderBasedDependencies(task: Task): Boolean {
  return findProviderBasedDependencies(task).isNotEmpty()
}
