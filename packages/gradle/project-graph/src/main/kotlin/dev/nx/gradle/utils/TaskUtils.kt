package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.ExternalDepData
import dev.nx.gradle.data.ExternalNode
import java.io.File
import org.gradle.api.Task

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
    targetNameOverrides: Map<String, String>
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
  val dependsOn = getDependsOnForTask(dependsOnTasks, task, dependencies, targetNameOverrides)
  if (!dependsOn.isNullOrEmpty()) {
    logger.info("${task}: processed ${dependsOn.size} dependsOn")
    target["dependsOn"] = dependsOn
  }

  // process inputs
  val inputs = getInputsForTask(dependsOnTasks, task, projectRoot, workspaceRoot, externalNodes)
  if (!inputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${inputs.size} inputs")
    target["inputs"] = inputs
  }

  target["executor"] = "@nx/gradle:gradle"

  val taskName = targetNameOverrides.getOrDefault("${task.name}TargetName", task.name)
  val metadata =
      getMetadata(
          task.description ?: "Run ${projectBuildPath}.$taskName", projectBuildPath, taskName)
  target["metadata"] = metadata

  target["options"] =
      if (continuous) {
        mapOf(
            "taskName" to "${projectBuildPath}:$taskName",
            "continuous" to true,
            "excludeDependsOn" to shouldExcludeDependsOn(task))
      } else {
        mapOf("taskName" to "${projectBuildPath}:$taskName")
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
 * @param task task to process
 * @param projectRoot the project root path
 * @param workspaceRoot the workspace root path
 * @param externalNodes map of external nodes
 * @return a list of inputs including external dependencies, null if empty or an error occurred
 */
fun getInputsForTask(
    dependsOnTasks: Set<Task>?,
    task: Task,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>? = null
): List<Any>? {
  fun getDependentTasksOutputFile(file: File): String {
    val relativePathToWorkspaceRoot =
        file.path.substring(workspaceRoot.length + 1) // also remove the file separator
    val dependentTasksOutputFiles =
        if (file.name.contains('.') ||
            (file.exists() &&
                file.isFile)) { // if file does not exists, file.isFile would always be false
          relativePathToWorkspaceRoot
        } else {
          "$relativePathToWorkspaceRoot${File.separator}**${File.separator}*"
        }
    return dependentTasksOutputFiles
  }

  return try {
    val mappedInputsIncludeExternal: MutableList<Any> = mutableListOf()

    val dependsOnOutputs: MutableSet<File> = mutableSetOf()
    val combinedDependsOn: Set<Task> = dependsOnTasks ?: getDependsOnTask(task)
    combinedDependsOn.forEach { dependsOnTask ->
      dependsOnTask.outputs.files.files.forEach { file ->
        if (file.path.startsWith(workspaceRoot + File.separator)) {
          dependsOnOutputs.add(file)
          val dependentTasksOutputFiles = getDependentTasksOutputFile(file)
          mappedInputsIncludeExternal.add(
              mapOf("dependentTasksOutputFiles" to dependentTasksOutputFiles))
        }
      }
    }

    val externalDependencies = mutableListOf<String>()
    val buildDir = task.project.layout.buildDirectory.get().asFile

    task.inputs.files.forEach { file ->
      val path: String = file.path
      val pathWithReplacedRoot = replaceRootInPath(path, projectRoot, workspaceRoot)

      if (pathWithReplacedRoot != null) {
        val isInTaskOutputBuildDir = file.path.startsWith(buildDir.path + File.separator)
        if (!isInTaskOutputBuildDir) {
          mappedInputsIncludeExternal.add(pathWithReplacedRoot)
        } else {
          val isInDependsOnOutputs =
              dependsOnOutputs.any { outputFile ->
                file == outputFile || file.path.startsWith(outputFile.path + File.separator)
              }
          if (!isInDependsOnOutputs) {
            val dependentTasksOutputFile = getDependentTasksOutputFile(file)
            mappedInputsIncludeExternal.add(
                mapOf("dependentTasksOutputFiles" to dependentTasksOutputFile))
          }
        }
      } else {
        try {
          val externalDep = getExternalDepFromInputFile(path, externalNodes, task.logger)
          externalDep?.let { externalDependencies.add(it) }
        } catch (e: Exception) {
          task.logger.info("${task}: get external dependency error $e")
        }
      }
    }

    if (externalDependencies.isNotEmpty()) {
      mappedInputsIncludeExternal.add(mapOf("externalDependencies" to externalDependencies))
    }

    if (mappedInputsIncludeExternal.isNotEmpty()) {
      return mappedInputsIncludeExternal
    }
    return null
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
 * based on targetNameOverrides (e.g., test -> ci).
 *
 * @param task task to process
 * @param dependencies optional set to collect inter-project Dependency objects
 * @param targetNameOverrides optional map of overrides (e.g., test -> ci)
 * @return list of dependsOn task names (possibly replaced), or null if none found or error occurred
 */
// Add a thread-local cache to prevent infinite recursion in dependency resolution
internal val taskDependencyCache = ThreadLocal.withInitial { mutableMapOf<String, List<String>?>() }

fun getDependsOnForTask(
    dependsOnTasks: Set<Task>?,
    task: Task,
    dependencies: MutableSet<Dependency>? = null,
    targetNameOverrides: Map<String, String> = emptyMap()
): List<String>? {

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
        val taskName = targetNameOverrides.getOrDefault(depTask.name + "TargetName", depTask.name)
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

private val tasksWithDependsOn = setOf("bootRun", "bootJar")

fun shouldExcludeDependsOn(task: Task): Boolean {
  return !tasksWithDependsOn.contains(task.name)
}
