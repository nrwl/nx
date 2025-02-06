package dev.nx.gradle.native

import org.gradle.api.Project
import org.gradle.api.artifacts.ProjectDependency

/**
 * Loops through a project and populate dependencies and nodes for each target
 */
fun createNodeForProject(project: Project): GradleNodeReport {
    val gradleNodeReport = GradleNodeReport(null, null, null)
    val logger = project.logger
    logger.info("createNodeForProject: get nodes and dependencies for $project")

    try {
        // get dependencies of project
        val dependencies = getDependenciesForProject(project, project.allprojects)
        gradleNodeReport.dependencies = dependencies
        logger.info("createNodeForProject: get dependencies for $project")
    } catch (e: Exception) {
        logger.info("createNodeForProject: get dependencies error $e")
    }


    try {
        val gradleTargets: GradleTargets = processTargetsForProject(project)
        val projectRoot = project.projectDir.path
        val projectNode = ProjectNode(
                gradleTargets.targets,
                NodeMetadata(gradleTargets.targetGroups, listOf("gradle"), project.description),
                project.name
        )
        gradleNodeReport.nodes = mutableMapOf(projectRoot to projectNode)

        gradleNodeReport.externalNodes = gradleTargets.externalNodes
        logger.info("CreateNodes: get nodes and external nodes for $projectRoot")
    } catch (e: Exception) {
        logger.info("${project}: get nodes error $e")
    }
    return gradleNodeReport
}

/**
 * Get dependent projects for current projects
 * It is going to modify the dependencies in place
 */
fun getDependenciesForProject(project: Project, allProjects: Set<Project>): MutableSet<Dependency> {
    val dependencies = mutableSetOf<Dependency>()
    project.configurations.filter { config ->
        val configName = config.name
        configName == "compileClasspath" || configName == "implementationDependenciesMetadata"
    }.forEach {
        it.allDependencies.filterIsInstance<ProjectDependency>().forEach {
            val foundProject = allProjects.find { p -> p.name == it.name }
            if (foundProject != null) {
                dependencies.add(
                        Dependency(
                                project.projectDir.path,
                                foundProject.projectDir.path,
                                project.buildFile.path
                        )
                )
            }
        }
    }
    project.subprojects.forEach { childProject ->
        dependencies.add(
                Dependency(
                        project.projectDir.path,
                        childProject.projectDir.path,
                        project.buildFile.path
                )
        )
    }
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
