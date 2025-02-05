package dev.nx.gradle.native

import org.gradle.api.Project
import org.gradle.api.Plugin
import com.google.gson.Gson

/**
 * A plugin to create nx nodes, dependencies and external nodes
 */
class NodesPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        // Register a task
        project.tasks.register("createNodes", CreateNodesTask::class.java) { task ->
            val gradleNodeReport = createNodeForProject(project)

            task.projectName = project.name
            val gson = Gson()
            val json = gson.toJson(gradleNodeReport)
            task.json = json

            task.setDescription("Create nodes and dependencies for Nx")
            task.setGroup("Nx Custom")

            // Run task for composite builds
            project.getGradle().includedBuilds.forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }

    /**
     * Loops through all projects and populate dependencies and nodes for each target
     */
    fun createNodeForProject(rootProject: Project): GradleNodeReport {
        val gradleNodeReport = GradleNodeReport(null, null, null)
        val logger = rootProject.getLogger()
        logger.info("createNodeForProject: get nodes and dependencies for ${rootProject}")

        try {
            // get dependencies of project
            val dependencies = getDependenciesForProject(rootProject, rootProject.getAllprojects())
            gradleNodeReport.dependencies = dependencies
            logger.info("createNodeForProject: get dependencies for ${rootProject}")
        } catch (e: Exception) {
            logger.info("createNodeForProject: get dependencies error ${e.toString()}")
        }

        try {
            val gradleTargets: GradleTargets = processTargetsForProject(rootProject)
            var projectRoot = rootProject.getProjectDir().getPath()
            val projectNode = ProjectNode(
                    gradleTargets.targets,
                    NodeMetadata(gradleTargets.targetGroups, arrayOf("gradle"), rootProject.getDescription()),
                    rootProject.getName()
            )
            gradleNodeReport.nodes = mutableMapOf<String, ProjectNode>(projectRoot to projectNode)

            gradleNodeReport.externalNodes = gradleTargets.externalNodes
            logger.info("CreateNodes: get nodes and external nodes for ${projectRoot}")
        } catch (e: Exception) {
            logger.info("${rootProject}: get nodes error ${e.toString()}")
        }
        return gradleNodeReport
    }
}

