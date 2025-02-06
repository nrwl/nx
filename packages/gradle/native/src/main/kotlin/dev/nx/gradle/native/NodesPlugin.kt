package dev.nx.gradle.native

import org.gradle.api.Plugin
import org.gradle.api.Project

/**
 * A plugin to create nx nodes, dependencies and external nodes
 */
class NodesPlugin : Plugin<Project> {

    override fun apply(project: Project) {
        val gradleNodeReport = project.objects.property(GradleNodeReport::class.java)

        // Initialize and store data in GradleNodeReport safely
        project.gradle.projectsEvaluated {
            val report = createNodeForProject(project)
            gradleNodeReport.set(report)
        }

        // Register a task
        project.tasks.register("createNodes", CreateNodesTask::class.java) { task ->
            task.projectName = project.name
            task.gradleNodeReport.set(gradleNodeReport)

            task.description = "Create nodes and dependencies for Nx"
            task.group = "Nx Custom"

            // Run task for composite builds
            project.gradle.includedBuilds.forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }
}

