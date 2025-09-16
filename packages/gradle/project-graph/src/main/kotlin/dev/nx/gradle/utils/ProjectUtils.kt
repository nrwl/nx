package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import java.util.*
import org.gradle.api.Project
import org.gradle.api.tasks.testing.Test

/** Loops through a project and populate dependencies and nodes for each target */
fun createNodeForProject(
    project: Project,
    targetNameOverrides: Map<String, String>,
    workspaceRoot: String,
    atomized: Boolean
): GradleNodeReport {
  val logger = project.logger
  logger.info("${Date()} ${project.name} createNodeForProject: get nodes and dependencies")

  // Initialize dependencies with an empty Set to prevent null issues
  val dependencies: MutableSet<Dependency> =
      try {
        getDependenciesForProject(project)
      } catch (e: Exception) {
        logger.info(
            "${Date()} ${project.name} createNodeForProject: get dependencies error: ${e.message}")
        mutableSetOf()
      }
  logger.info("${Date()} ${project.name} createNodeForProject: got dependencies")

  // Initialize nodes and externalNodes with empty maps to prevent null issues
  var nodes: Map<String, ProjectNode>
  var externalNodes: Map<String, ExternalNode>

  try {
    val gradleTargets: GradleTargets =
        processTargetsForProject(
            project, dependencies, targetNameOverrides, workspaceRoot, atomized)
    val projectRoot = project.projectDir.path
    val projectNode =
        ProjectNode(
            targets = gradleTargets.targets,
            metadata =
                NodeMetadata(gradleTargets.targetGroups, listOf("gradle"), project.description),
            name =
                if (project.buildTreePath.isEmpty() || project.buildTreePath == ":") project.name
                else project.buildTreePath)
    nodes = mapOf(projectRoot to projectNode)
    externalNodes = gradleTargets.externalNodes
    logger.info(
        "${Date()} ${project.name} createNodeForProject: get nodes and external nodes for $projectRoot")
  } catch (e: Exception) {
    logger.info("${project.name}: get nodes error: ${e.message}")
    nodes = emptyMap()
    externalNodes = emptyMap()
  }
  val buildFileRelativePath =
      if (project.buildFile.exists()) {
        project.buildFile.relativeTo(File(workspaceRoot)).path
      } else {
        null
      }
  return GradleNodeReport(
      nodes, dependencies, externalNodes, buildFileRelativePath?.let { listOf(it) } ?: emptyList())
}

/**
 * Process targets for project
 *
 * @return targets and targetGroups
 */
fun processTargetsForProject(
    project: Project,
    dependencies: MutableSet<Dependency>,
    targetNameOverrides: Map<String, String>,
    workspaceRoot: String,
    atomized: Boolean
): GradleTargets {
  val targets: NxTargets = mutableMapOf()
  val targetGroups: TargetGroups = mutableMapOf()
  val externalNodes = mutableMapOf<String, ExternalNode>()

  val projectRoot = project.projectDir.path
  val logger = project.logger

  logger.info("Using workspace root: $workspaceRoot")

  val projectBuildPath = project.buildTreePath.trimEnd(':')

  logger.info("${Date()} ${project}: Process targets")

  val ciTestTargetName = targetNameOverrides["ciTestTargetName"]
  val testTargetName = targetNameOverrides.getOrDefault("testTargetName", "test")

  val testTasks = project.tasks.withType(Test::class.java)
  val hasCiTestTarget = ciTestTargetName != null && testTasks.isNotEmpty() && atomized

  logger.info(
      "${project.name}: hasCiTestTarget = $hasCiTestTarget (ciTestTargetName=$ciTestTargetName, testTasks.size=${testTasks.size}, atomized=$atomized)")

  project.tasks.forEach { task ->
    try {
      val now = Date()
      logger.info("$now ${project.name}: Processing task ${task.path}")

      // Apply target name override if applicable
      val targetName =
          if (task.name == "test" && targetNameOverrides.containsKey("testTargetName")) {
            targetNameOverrides["testTargetName"]!!
          } else {
            task.name
          }

      // Group task under its group if available, using the overridden name
      task.group
          ?.takeIf { it.isNotBlank() }
          ?.let { group -> targetGroups.getOrPut(group) { mutableListOf() }.add(targetName) }

      val target =
          processTask(
              task,
              projectBuildPath,
              projectRoot,
              workspaceRoot,
              externalNodes,
              dependencies,
              targetNameOverrides)

      targets[targetName] = target

      if (hasCiTestTarget && task.name.startsWith("compileTest")) {
        addTestCiTargets(
            task.inputs.sourceFiles,
            projectBuildPath,
            testTasks.first(),
            targets,
            targetGroups,
            projectRoot,
            workspaceRoot,
            ciTestTargetName)
      }

      if (ciTestTargetName != null) {
        val ciCheckTargetName = targetNameOverrides.getOrDefault("ciCheckTargetName", "check-ci")
        if (task.name == "check") {
          val replacedDependencies =
              (target["dependsOn"] as? List<*>)?.map { dep ->
                val dependsOn = dep.toString()
                if (hasCiTestTarget && dependsOn == "${project.name}:$testTargetName") {
                  "${project.name}:$ciTestTargetName"
                } else {
                  dep
                }
              } ?: emptyList()

          val newTarget: MutableMap<String, Any?> =
              mutableMapOf(
                  "dependsOn" to replacedDependencies,
                  "executor" to "nx:noop",
                  "cache" to true,
                  "metadata" to getMetadata("Runs Gradle Check in CI", projectBuildPath, "check"))

          targets[ciCheckTargetName] = newTarget
          ensureTargetGroupExists(targetGroups, testCiTargetGroup)
          targetGroups[testCiTargetGroup]?.add(ciCheckTargetName)
        }

        if (task.name == "build") {
          val ciBuildTargetName = targetNameOverrides.getOrDefault("ciBuildTargetName", "build-ci")
          val replacedDependencies =
              (target["dependsOn"] as? List<*>)?.map { dep ->
                val dependsOn = dep.toString()
                if (dependsOn == "${project.name}:check") {
                  "${project.name}:$ciCheckTargetName"
                } else {
                  dep
                }
              } ?: emptyList()

          val newTarget: MutableMap<String, Any?> =
              mutableMapOf(
                  "dependsOn" to replacedDependencies,
                  "executor" to "nx:noop",
                  "cache" to true,
                  "metadata" to getMetadata("Runs Gradle Build in CI", projectBuildPath, "build"))

          targets[ciBuildTargetName] = newTarget
          ensureTargetGroupExists(targetGroups, "build")
          targetGroups["build"]?.add(ciBuildTargetName)
        }
      }

      logger.info("$now ${project.name}: Processed task ${task.path}")
    } catch (e: Exception) {
      logger.error("Error processing task ${task.path}: ${e.message}", e)
    }
  }

  logger.info("Final targets in processTargetsForProject: $targets")
  return GradleTargets(targets, targetGroups, externalNodes)
}
