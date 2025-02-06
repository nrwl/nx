package dev.nx.gradle.native.utils

import dev.nx.gradle.native.data.*
import org.gradle.api.Project
import org.gradle.api.artifacts.component.ModuleComponentSelector
import org.gradle.api.artifacts.component.ProjectComponentSelector
import org.gradle.api.artifacts.result.ResolvedDependencyResult

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

fun getDependenciesForProject(project: Project, allProjects: Set<Project>): MutableSet<Dependency> {
    val dependencies = mutableSetOf<Dependency>()
    val logger = project.logger

    // Ensure both configurations are accessed explicitly
    val configurationsToCheck = listOf("compileClasspath", "implementationDependenciesMetadata")

    configurationsToCheck.forEach { configName ->
        val configuration = project.configurations.findByName(configName)
        if (configuration != null) {
            try {
                configuration.incoming.resolutionResult.allDependencies.forEach { dependencyResult ->
                    when (dependencyResult) {
                        is ResolvedDependencyResult -> {
                            val requested = dependencyResult.requested

                            // If it's a project dependency
                            if (requested is ProjectComponentSelector) {
                                val foundProject = allProjects.find { it.path == requested.projectPath }
                                if (foundProject != null) {
                                    dependencies.add(
                                            Dependency(
                                                    project.projectDir.path,
                                                    foundProject.projectDir.path,
                                                    project.buildFile.path
                                            )
                                    )
                                    logger.lifecycle("Found project dependency: ${foundProject.name} in $configName")
                                }
                            }

                            // If it's an external module dependency
                            if (requested is ModuleComponentSelector) {
                                val dependencyKey = "${requested.group}:${requested.module}:${requested.version}"
                                dependencies.add(
                                        Dependency(
                                                project.projectDir.path,
                                                dependencyKey,  // External dependencies are identified by coordinates
                                                project.buildFile.path
                                        )
                                )
                                logger.lifecycle("Found external dependency: $dependencyKey in $configName")
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                logger.warn("Error checking configuration $configName for ${project.name}: ${e.message}")
            }
        } else {
            logger.warn("Configuration $configName not found in project ${project.name}")
        }
    }

    // Include subprojects manually
    project.subprojects.forEach { childProject ->
        dependencies.add(
                Dependency(
                        project.projectDir.path,
                        childProject.projectDir.path,
                        project.buildFile.path
                )
        )
    }

    // Include included builds manually
    project.gradle.includedBuilds.forEach { includedBuild ->
        dependencies.add(
                Dependency(
                        project.projectDir.path,
                        includedBuild.projectDir.path,
                        project.buildFile.path
                )
        )
    }

    return dependencies
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
