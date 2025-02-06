package dev.nx.gradle.native.utils

import dev.nx.gradle.native.data.*
import org.gradle.api.Project

/**
 * Loops through a project and populate dependencies and nodes for each target
 */
fun createNodeForProject(project: Project): GradleNodeReport {
    val logger = project.logger
    logger.info("createNodeForProject: get nodes and dependencies for ${project.name}")

    // Initialize dependencies with an empty Set to prevent null issues
    val dependencies: Set<Dependency> = try {
        getDependenciesForProject(project, project.allprojects).toSet()
    } catch (e: Exception) {
        logger.info("createNodeForProject: get dependencies error: ${e.message}")
        emptySet()
    }

    // Initialize nodes and externalNodes with empty maps to prevent null issues
    var nodes: Map<String, ProjectNode>
    var externalNodes: Map<String, ExternalNode>

    try {
        val gradleTargets: GradleTargets = processTargetsForProject(project)
        val projectRoot = project.projectDir.path
        val projectNode = ProjectNode(
                targets = gradleTargets.targets,
                metadata = NodeMetadata(gradleTargets.targetGroups, listOf("gradle"), project.description),
                name = project.name
        )
        nodes = mapOf(projectRoot to projectNode)
        externalNodes = gradleTargets.externalNodes
        logger.info("CreateNodes: get nodes and external nodes for $projectRoot")
    } catch (e: Exception) {
        logger.info("${project.name}: get nodes error: ${e.message}")
        nodes = emptyMap()
        externalNodes = emptyMap()
    }
    return GradleNodeReport(nodes, dependencies, externalNodes)
}

/**
 * Process targets for project
 * @return targets and targetGroups
 */
fun processTargetsForProject(
        project: Project,
): GradleTargets {
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val projectRoot = project.projectDir.path
    val workspaceRoot = workspaceRootInner(System.getProperty("user.dir"), System.getProperty("user.dir"))
    project.logger.info("Using workspace root $workspaceRoot")

    var projectBuildPath: String = project.buildTreePath // get the build path of project e.g. :app, :utils:number-utils, :buildSrc
    if (projectBuildPath.endsWith(":")) { // root project is ":", manually remove last :
        projectBuildPath = projectBuildPath.dropLast(1)
    }

    val logger = project.logger

    logger.info("${project}: process targets")

    var gradleProject = project.buildTreePath
    if (!gradleProject.endsWith(":")) {
        gradleProject += ":"
    }

    project.tasks.forEach { task ->
        try {
            logger.info("Processing $task")
            // add task to target groups
            val group: String? = task.group
            if (!group.isNullOrBlank()) {
                if (targetGroups.contains(group)) {
                    targetGroups[group]?.add(task.name)
                } else {
                    targetGroups[group] = mutableListOf(task.name)
                }
            }

            val target = processTask(task, projectBuildPath, projectRoot, workspaceRoot, externalNodes)
            targets[task.name] = target

            if (task.name.startsWith("compileTest")) {
                addTestCiTargets(
                        task.inputs.sourceFiles,
                        projectBuildPath,
                        target,
                        targets,
                        targetGroups,
                        projectRoot,
                        workspaceRoot
                )
            }
        } catch (e: Exception) {
            logger.info("${task}: process task error $e")
            logger.debug("Stack trace:", e)
        }
    }

    return GradleTargets(
            targets,
            targetGroups,
            externalNodes
    )
}
