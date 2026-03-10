package dev.nx.gradle.utils

import dev.nx.gradle.NxProjectExtension
import dev.nx.gradle.data.*
import java.io.File
import java.util.*
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.testing.Test

/**
 * Get the Nx project name from a Gradle project. This returns the buildTreePath with `:` prefix for
 * subprojects (e.g., `:app`, `:lib:core`), or just the project name for root projects.
 */
fun getNxProjectName(project: Project): String =
    if (project.buildTreePath.isEmpty() || project.buildTreePath == ":") project.name
    else project.buildTreePath

/** Loops through a project and populate dependencies and nodes for each target */
fun createNodeForProject(
    project: Project,
    targetNameOverrides: Map<String, String>,
    workspaceRoot: String,
    atomized: Boolean,
    targetNamePrefix: String = ""
): GradleNodeReport {
  val logger = project.logger
  logger.info("${Date()} ${project.name} createNodeForProject: get nodes and dependencies")

  val dependencies: MutableSet<Dependency> = mutableSetOf()

  // Initialize nodes and externalNodes with empty maps to prevent null issues
  var nodes: Map<String, ProjectNode>
  var externalNodes: Map<String, ExternalNode>

  try {
    val gradleTargets: GradleTargets =
        processTargetsForProject(
            project, dependencies, targetNameOverrides, workspaceRoot, atomized, targetNamePrefix)

    try {
      val configDependencies = getDependenciesForProject(project)
      dependencies.addAll(configDependencies)
      logger.info("${Date()} ${project.name} createNodeForProject: got configuration dependencies")
    } catch (e: Exception) {
      logger.info(
          "${Date()} ${project.name} createNodeForProject: get dependencies error: ${e.message}")
    }
    val projectRoot = project.projectDir.path

    // Read project-level nx config if it exists
    val nxProjectExtension = project.extensions.findByType(NxProjectExtension::class.java)
    val nxConfig = nxProjectExtension?.json?.getOrNull()?.takeIf { it.isNotEmpty() }

    // Use Gradle defaults for project metadata (TypeScript side will merge nxConfig)
    val projectName = getNxProjectName(project)
    val projectDescription = project.description

    val projectNode =
        ProjectNode(
            targets = gradleTargets.targets,
            metadata =
                NodeMetadata(gradleTargets.targetGroups, listOf("gradle"), projectDescription),
            name = projectName,
            nxConfig = nxConfig)
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
    atomized: Boolean,
    targetNamePrefix: String = ""
): GradleTargets {
  val targets: NxTargets = mutableMapOf()
  val targetGroups: TargetGroups = mutableMapOf()
  val externalNodes = mutableMapOf<String, ExternalNode>()

  val projectRoot = project.projectDir.path
  val logger = project.logger

  logger.info("Using workspace root: $workspaceRoot")
  logger.info("Using target name prefix: '$targetNamePrefix'")

  // Helper function to apply prefix to target names
  fun applyPrefix(name: String): String =
      if (targetNamePrefix.isNotEmpty()) "$targetNamePrefix$name" else name

  // Create GitIgnoreClassifier once for the entire project
  val gitIgnoreClassifier = GitIgnoreClassifier(File(workspaceRoot))

  val projectBuildPath = project.buildTreePath.trimEnd(':')
  val nxProjectName = getNxProjectName(project)

  logger.info("${Date()} ${project}: Process targets")

  val ciTestTargetBaseName = targetNameOverrides["ciTestTargetName"]?.let { applyPrefix(it) }
  val testTargetName = applyPrefix(targetNameOverrides.getOrDefault("testTargetName", "test"))

  // Create a snapshot of test tasks to avoid ConcurrentModificationException
  // with Kotlin Multiplatform which adds tasks dynamically
  val testTasks = project.tasks.withType(Test::class.java).toList()
  val hasCiTestTarget = ciTestTargetBaseName != null && testTasks.isNotEmpty() && atomized
  // Pre-index test tasks by prefixed name for O(1) lookup during dependency replacement
  val testTasksByPrefixedName = testTasks.associateBy { applyPrefix(it.name) }

  logger.info(
      "${project.name}: hasCiTestTarget = $hasCiTestTarget (ciTestTargetName=$ciTestTargetBaseName, testTasks.size=${testTasks.size}, atomized=$atomized)")

  // Create a snapshot of all tasks to avoid ConcurrentModificationException
  // with Kotlin Multiplatform which adds tasks dynamically
  project.tasks.toList().forEach { task ->
    try {
      val now = Date()
      logger.info("$now ${project.name}: Processing task ${task.path}")

      val targetName = resolveTargetName(task, targetNameOverrides, targetNamePrefix)

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
              targetNameOverrides,
              gitIgnoreClassifier,
              targetNamePrefix,
              project)

      targets[targetName] = target

      val isCompileTestTask =
          task.name.startsWith("compile") && task.name.contains("test", ignoreCase = true)
      if (hasCiTestTarget && isCompileTestTask) {
        // Find the matching test task for this compile task
        // We need to match based on the actual dependencies between tasks
        val matchingTestTasks =
            testTasks.filter { testTask ->
              if (testTask is Test) {
                // Check if the test task's classpath includes the compile task's outputs
                val testClasspath = testTask.classpath.files
                val compileOutputs = task.outputs.files.files
                compileOutputs.any { output -> testClasspath.contains(output) }
              } else {
                false
              }
            }

        matchingTestTasks.forEach {
          val ciTestTargetName =
              if (it.name == "test") {
                ciTestTargetBaseName
              } else {
                "$ciTestTargetBaseName-${it.name}"
              }

          addTestCiTargets(
              task.inputs.sourceFiles,
              projectBuildPath,
              it,
              targets,
              targetGroups,
              projectRoot,
              workspaceRoot,
              ciTestTargetName,
              gitIgnoreClassifier,
              targetNameOverrides,
              targetNamePrefix)
        }
      }

      if (ciTestTargetBaseName != null) {
        val ciCheckTargetName =
            applyPrefix(targetNameOverrides.getOrDefault("ciCheckTargetName", "check-ci"))

        // Build CI test replacements: maps original target names to their CI equivalents
        // e.g., "test" -> "ci-test", "testDebug" -> "ci-test-testDebug"
        val ciTestReplacements = mutableMapOf<String, String>()
        if (hasCiTestTarget) {
          testTasksByPrefixedName.forEach { (prefixedName, testTask) ->
            ciTestReplacements[prefixedName] = "$ciTestTargetBaseName-${testTask.name}"
          }
          // The default test target gets the base CI name (e.g., "test" -> "ci-test")
          // Set after the loop so it takes priority over the generic pattern
          ciTestReplacements[testTargetName] = ciTestTargetBaseName!!
        }

        if (task.name == "check") {
          val ciCheckDependsOn =
              buildCiDependsOn(
                  task, project, targetNameOverrides, targetNamePrefix, ciTestReplacements)

          targets[ciCheckTargetName] =
              mutableMapOf(
                  "dependsOn" to ciCheckDependsOn,
                  "executor" to "nx:noop",
                  "cache" to true,
                  "metadata" to getMetadata("Runs Gradle Check in CI", projectBuildPath, "check"))
          ensureTargetGroupExists(targetGroups, testCiTargetGroup)
          targetGroups[testCiTargetGroup]?.add(ciCheckTargetName)
        }

        if (task.name == "build") {
          val ciBuildTargetName =
              applyPrefix(targetNameOverrides.getOrDefault("ciBuildTargetName", "build-ci"))
          val ciBuildDependsOn =
              buildCiDependsOn(
                  task,
                  project,
                  targetNameOverrides,
                  targetNamePrefix,
                  mapOf(applyPrefix("check") to ciCheckTargetName))

          targets[ciBuildTargetName] =
              mutableMapOf(
                  "dependsOn" to ciBuildDependsOn,
                  "executor" to "nx:noop",
                  "cache" to true,
                  "metadata" to getMetadata("Runs Gradle Build in CI", projectBuildPath, "build"))
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

/**
 * Build CI dependsOn list from a task's Gradle dependencies. Splits into same-project and
 * cross-project entries, groups cross-project deps by target, and optionally replaces same-project
 * target names using the provided map (e.g., test -> ci-test, check -> ci-check).
 */
fun buildCiDependsOn(
    task: Task,
    project: Project,
    targetNameOverrides: Map<String, String>,
    targetNamePrefix: String,
    sameProjectReplacements: Map<String, String> = emptyMap()
): List<DependsOnEntry> {
  val allDeps = getDependsOnTask(task)
  val result = mutableListOf<DependsOnEntry>()
  val crossProjectByTarget = mutableMapOf<String, MutableList<String>>()

  allDeps.forEach { depTask ->
    val depProject = depTask.project
    if (depProject.buildFile.path != null && depProject.buildFile.exists()) {
      val depTargetName = resolveTargetName(depTask, targetNameOverrides, targetNamePrefix)

      if (depProject == project) {
        val finalName = sameProjectReplacements[depTargetName] ?: depTargetName
        result.add(DependsOnEntry(target = finalName))
      } else {
        crossProjectByTarget
            .getOrPut(depTargetName) { mutableListOf() }
            .add(getNxProjectName(depProject))
      }
    }
  }

  crossProjectByTarget.forEach { (targetName, projects) ->
    result.add(DependsOnEntry(target = targetName, projects = projects.distinct()))
  }

  return result
}

/** Resolve a dependency task's target name, applying overrides and prefix. */
fun resolveTargetName(
    depTask: Task,
    targetNameOverrides: Map<String, String>,
    targetNamePrefix: String
): String {
  val baseName =
      if (depTask.name == "test" && targetNameOverrides.containsKey("testTargetName")) {
        targetNameOverrides["testTargetName"]!!
      } else {
        depTask.name
      }
  return if (targetNamePrefix.isNotEmpty()) "$targetNamePrefix$baseName" else baseName
}
