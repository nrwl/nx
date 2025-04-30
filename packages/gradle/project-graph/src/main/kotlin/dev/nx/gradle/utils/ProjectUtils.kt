package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.util.*
import org.gradle.api.Project

/** Loops through a project and populate dependencies and nodes for each target */
fun createNodeForProject(
    project: Project,
    targetNameOverrides: Map<String, String>,
    workspaceRoot: String,
    cwd: String
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
        processTargetsForProject(project, dependencies, targetNameOverrides, workspaceRoot, cwd)
    val projectRoot = project.projectDir.path
    val projectNode =
        ProjectNode(
            targets = gradleTargets.targets,
            metadata =
                NodeMetadata(gradleTargets.targetGroups, listOf("gradle"), project.description),
            name = project.name)
    nodes = mapOf(projectRoot to projectNode)
    externalNodes = gradleTargets.externalNodes
    logger.info(
        "${Date()} ${project.name} createNodeForProject: get nodes and external nodes for $projectRoot")
  } catch (e: Exception) {
    logger.info("${project.name}: get nodes error: ${e.message}")
    nodes = emptyMap()
    externalNodes = emptyMap()
  }
  return GradleNodeReport(nodes, dependencies, externalNodes)
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
    cwd: String
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
  val ciIntTestTargetName = targetNameOverrides["ciIntTestTargetName"]
  val ciCheckTargetName = targetNameOverrides.getOrDefault("ciCheckTargetName", "check-ci")
  val testTargetName = targetNameOverrides.getOrDefault("testTargetName", "test")
  val intTestTargetName = targetNameOverrides.getOrDefault("intTestTargetName", "intTest")

  val testTasks = project.getTasksByName("test", false)
  val intTestTasks = project.getTasksByName("intTest", false)
  val hasCiTestTarget = ciTestTargetName != null && testTasks.isNotEmpty()
  val hasCiIntTestTarget = ciIntTestTargetName != null && intTestTasks.isNotEmpty()

  project.tasks.forEach { task ->
    try {
      val now = Date()
      logger.info("$now ${project.name}: Processing task ${task.path}")

      val taskName = targetNameOverrides.getOrDefault("${task.name}TargetName", task.name)

      // Group task under its group if available
      task.group
          ?.takeIf { it.isNotBlank() }
          ?.let { group -> targetGroups.getOrPut(group) { mutableListOf() }.add(taskName) }

      val target =
          processTask(
              task,
              projectBuildPath,
              projectRoot,
              workspaceRoot,
              externalNodes,
              dependencies,
              targetNameOverrides)

      targets[taskName] = target

      if (hasCiTestTarget && task.name.startsWith("compileTest")) {
        addTestCiTargets(
            task.inputs.sourceFiles,
            projectBuildPath,
            testTasks.first(),
            testTargetName,
            targets,
            targetGroups,
            projectRoot,
            workspaceRoot,
            ciTestTargetName!!)
      }

      if (hasCiIntTestTarget && task.name.startsWith("compileIntTest")) {
        addTestCiTargets(
            task.inputs.sourceFiles,
            projectBuildPath,
            intTestTasks.first(),
            intTestTargetName,
            targets,
            targetGroups,
            projectRoot,
            workspaceRoot,
            ciIntTestTargetName!!)
      }

      if (task.name == "check" && (hasCiTestTarget || hasCiIntTestTarget)) {
        val replacedDependencies =
            (target["dependsOn"] as? List<*>)?.map { dep ->
              when (dep.toString()) {
                testTargetName -> ciTestTargetName ?: dep
                intTestTargetName -> ciIntTestTargetName ?: dep
                else -> dep
              }.toString()
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

      logger.info("$now ${project.name}: Processed task ${task.path}")
    } catch (e: Exception) {
      logger.error("Error processing task ${task.path}: ${e.message}", e)
    }
  }

  return GradleTargets(targets, targetGroups, externalNodes)
}
