package dev.nx.gradle.native

import org.gradle.api.Project
import org.gradle.api.Plugin

/**
 * A plugin to create nx nodes, dependencies and external nodes
 */
class Nodes: Plugin<Project> {
    override fun apply(project: Project) {
        // Register a task
        project.tasks.register("createNodes", CreateNodesTask::class.java) { task ->
            val gradleNodesReport = createNodesForAllProjects(project)

            task.gradleNodesReport  = gradleNodesReport
            task.projectName = project.name

            task.setDescription("Create nodes and dependencies for Nx")
            task.setGroup("Nx Custom")
            // Run task for composite builds
            project.getGradle().includedBuilds.forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }

    /**
     * Lops through all projects and populate dependencies and nodes for each target
     */
    fun createNodesForAllProjects(rootProject: Project): GradleNodesReport {
        val projectNodes = mutableMapOf<String, Node>()
        val externalNodes = mutableMapOf<String, ExternalNode>()
        var dependencies = mutableSetOf<Dependency>()
        val allProjects = rootProject.getAllprojects()
        allProjects.forEach { subProject ->
            subProject.getLogger().info("CreateNodes: get nodes and dependencies for ${subProject}")
            try {
                // get dependencies of project
                getDependenciesForProject(subProject, dependencies, allProjects)
                subProject.getLogger().info("CreateNodes: get dependencies for ${subProject}")
            } catch (e: Exception) {
                subProject.getLogger().info("CreateNodes: get dependencies error ${e.toString()}")
            }

            try {
                val gradleTargets = processTargetsForProject(subProject)
                var projectRoot = subProject.getProjectDir().getPath()
                val projectNode = Node(
                        gradleTargets.targets,
                        Metadata(gradleTargets.targetGroups, arrayOf("gradle"), subProject.getDescription()),
                        subProject.getName()
                )
                subProject.logger.info("CreateNodes: get nodes for ${projectRoot}")
                projectNodes.put(projectRoot, projectNode)
            } catch (e: Exception) {
                subProject.getLogger().info("CreateNodes: get nodes error ${e.toString()}")
            }
        }
        return GradleNodesReport(projectNodes, dependencies, externalNodes)
    }
}

