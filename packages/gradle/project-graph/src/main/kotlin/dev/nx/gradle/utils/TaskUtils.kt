package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import org.gradle.api.Named
import org.gradle.api.NamedDomainObjectProvider
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

/**
 * Process a task and convert it into target Going to populate:
 * - cache
 * - inputs
 * - outputs
 * - command
 * - metadata
 * - options with cwd and args
 */
fun processTask(
    task: Task,
    projectBuildPath: String,
    projectRoot: String,
    workspaceRoot: String,
    cwd: String,
    externalNodes: MutableMap<String, ExternalNode>,
    dependencies: MutableSet<Dependency>,
    targetNameOverrides: Map<String, String>
): MutableMap<String, Any?> {
  val logger = task.logger
  logger.info("NxProjectReportTask: process $task for $projectRoot")
  val target = mutableMapOf<String, Any?>()
  target["cache"] = true // set cache to be always true

  // process inputs
  val inputs = getInputsForTask(task, projectRoot, workspaceRoot, externalNodes)
  if (!inputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${inputs.size} inputs")
    target["inputs"] = inputs
  }

  // process outputs
  val outputs = getOutputsForTask(task, projectRoot, workspaceRoot)
  if (!outputs.isNullOrEmpty()) {
    logger.info("${task}: processed ${outputs.size} outputs")
    target["outputs"] = outputs
  }

  // process dependsOn
  val dependsOn = getDependsOnForTask(task, dependencies, targetNameOverrides)
  if (!dependsOn.isNullOrEmpty()) {
    logger.info("${task}: processed ${dependsOn.size} dependsOn")
    target["dependsOn"] = dependsOn
  }

  val gradlewCommand = getGradlewCommand()
  target["command"] = "$gradlewCommand ${projectBuildPath}:${task.name}"

  val metadata = getMetadata(task.description ?: "Run ${task.name}", projectBuildPath, task.name)
  target["metadata"] = metadata

  target["options"] = mapOf("cwd" to cwd)

  return target
}

fun getGradlewCommand(): String {
  val gradlewCommand: String
  val operatingSystem = System.getProperty("os.name").lowercase()
  gradlewCommand =
      if (operatingSystem.contains("win")) {
        ".\\gradlew.bat"
      } else {
        "./gradlew"
      }
  return gradlewCommand
}

/**
 * Parse task and get inputs for this task
 *
 * @param task task to process
 * @return a list of inputs including external dependencies, null if empty or an error occurred
 */
fun getInputsForTask(
    task: Task,
    projectRoot: String,
    workspaceRoot: String,
    externalNodes: MutableMap<String, ExternalNode>?
): MutableList<Any>? {
  return try {
    val mappedInputsIncludeExternal: MutableList<Any> = mutableListOf()
    val inputs = task.inputs
    val externalDependencies = mutableListOf<String>()
    inputs.sourceFiles.forEach { file ->
      val path: String = file.path
      // replace the absolute path to contain {projectRoot} or {workspaceRoot}
      val pathWithReplacedRoot = replaceRootInPath(path, projectRoot, workspaceRoot)
      if (pathWithReplacedRoot != null) { // if the path is inside workspace
        mappedInputsIncludeExternal.add((pathWithReplacedRoot))
      }
      // if the path is outside of workspace
      if (pathWithReplacedRoot == null &&
          externalNodes != null) { // add it to external dependencies
        try {
          val externalDep = getExternalDepFromInputFile(path, externalNodes, task.logger)
          externalDep?.let { externalDependencies.add(it) }
        } catch (e: Exception) {
          task.logger.info("${task}: get external dependency error $e")
        }
      }
    }
    if (externalDependencies.isNotEmpty()) {
      mappedInputsIncludeExternal.add(mutableMapOf("externalDependencies" to externalDependencies))
    }
    if (mappedInputsIncludeExternal.isNotEmpty()) {
      return mappedInputsIncludeExternal
    }
    return null
  } catch (e: Exception) {
    // Log the error but don't fail the build
    task.logger.info("Error getting outputs for ${task.path}: ${e.message}")
    task.logger.debug("Stack trace:", e)
    null
  }
}

/**
 * Get outputs for task
 *
 * @param task task to process
 * @return list of outputs file, will not include if output file is outside workspace, null if empty
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
    // Log the error but don't fail the build
    task.logger.info("Error getting outputs for ${task.path}: ${e.message}")
    task.logger.debug("Stack trace:", e)
    null
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
fun getDependsOnForTask(
    task: Task,
    dependencies: MutableSet<Dependency>?,
    targetNameOverrides: Map<String, String> = emptyMap()
): List<String>? {

  fun mapTasksToNames(tasks: Collection<Task>): List<String> {
    return tasks.map { depTask ->
      val depProject = depTask.project
      val taskProject = task.project

      if (task.name != "buildDependents" && depProject != taskProject && dependencies != null) {
        dependencies.add(
            Dependency(
                taskProject.projectDir.path,
                depProject.projectDir.path,
                taskProject.buildFile.path))
      }

      // Check if this task name needs to be overridden
      val taskName = targetNameOverrides.getOrDefault(depTask.name + "TargetName", depTask.name)
      val overriddenTaskName =
          if (depProject == taskProject) {
            taskName
          } else {
            "${depProject.name}:${taskName}"
          }

      overriddenTaskName
    }
  }

  return try {
    val dependsOnEntries = task.dependsOn

    // Prefer task.dependsOn
    if (dependsOnEntries.isNotEmpty()) {
      val resolvedTasks =
          dependsOnEntries.flatMap { dep ->
            when (dep) {
              is Task -> listOf(dep)

              is TaskProvider<*>,
              is NamedDomainObjectProvider<*> -> {
                val providerName = (dep as Named).name
                val foundTask = task.project.tasks.findByName(providerName)
                if (foundTask != null) {
                  listOf(foundTask)
                } else {
                  task.logger.info(
                      "${dep::class.simpleName} '$providerName' did not resolve to a task in project ${task.project.name}")
                  emptyList()
                }
              }

              is String -> {
                val foundTask = task.project.tasks.findByPath(dep)
                if (foundTask != null) {
                  listOf(foundTask)
                } else {
                  task.logger.info(
                      "Task string '$dep' could not be resolved in project ${task.project.name}")
                  emptyList()
                }
              }

              else -> {
                task.logger.info(
                    "Unhandled dependency type ${dep::class.java} for task ${task.path}")
                emptyList()
              }
            }
          }

      if (resolvedTasks.isNotEmpty()) {
        return mapTasksToNames(resolvedTasks)
      }
    }

    // Fallback: taskDependencies.getDependencies(task)
    val fallbackDeps =
        try {
          task.taskDependencies.getDependencies(null)
        } catch (e: Exception) {
          task.logger.info("Error calling getDependencies for ${task.path}: ${e.message}")
          task.logger.debug("Stack trace:", e)
          emptySet<Task>()
        }

    if (fallbackDeps.isNotEmpty()) {
      return mapTasksToNames(fallbackDeps)
    }

    null
  } catch (e: Exception) {
    task.logger.info("Unexpected error getting dependencies for ${task.path}: ${e.message}")
    task.logger.debug("Stack trace:", e)
    null
  }
}

/**
 * Get metadata for task
 *
 * @param description
 */
fun getMetadata(
    description: String?,
    projectBuildPath: String,
    taskName: String,
    nonAtomizedTarget: String? = null
): Map<String, Any?> {
  val gradlewCommand = getGradlewCommand()
  return mapOf(
      "description" to description,
      "technologies" to arrayOf("gradle"),
      "help" to mapOf("command" to "$gradlewCommand help --task ${projectBuildPath}:${taskName}"),
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
 * @return The external dependency key (e.g., gradle:commons-lang3-3.13.0), or null if parsing
 *   fails.
 */
fun getExternalDepFromInputFile(
    inputFile: String,
    externalNodes: MutableMap<String, ExternalNode>,
    logger: org.gradle.api.logging.Logger
): String? {
  try {
    val segments = inputFile.split("/")

    // Expecting at least 5 segments to safely extract group, package, version, hash, filename
    if (segments.size < 5) {
      logger.warn("Invalid input path: '$inputFile'. Expected at least 5 segments.")
      return null
    }

    val fileName = segments.last()

    // Remove any file extension (after the last dot), if present
    val nameKey = fileName.substringBeforeLast(".", fileName)

    val hash = segments[segments.size - 2]
    val version = segments[segments.size - 3]
    val packageName = segments[segments.size - 4]
    val packageGroup = segments[segments.size - 5]

    val fullPackageName = "$packageGroup.$packageName"

    val data = ExternalDepData(version, fullPackageName, hash)
    val externalKey = "gradle:$nameKey"
    val node = ExternalNode("gradle", externalKey, data)

    externalNodes[externalKey] = node

    return externalKey
  } catch (e: Exception) {
    logger.warn("Failed to parse inputFile '$inputFile': ${e.message}")
    logger.debug("Stack trace:", e)
    return null
  }
}

/**
 * Going to replace the projectRoot with {projectRoot} and workspaceRoot with {workspaceRoot}
 *
 * @return mapped path if inside workspace, null if outside workspace
 */
fun replaceRootInPath(p: String, projectRoot: String, workspaceRoot: String): String? {
  var path = p
  if (path.startsWith(projectRoot)) {
    path = path.replace(projectRoot, "{projectRoot}")
    return path
  } else if (path.startsWith(workspaceRoot)) {
    path = path.replace(workspaceRoot, "{workspaceRoot}")
    return path
  }
  return null
}
