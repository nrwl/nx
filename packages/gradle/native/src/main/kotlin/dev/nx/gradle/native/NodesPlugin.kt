package dev.nx.gradle.native

import dev.nx.gradle.native.data.GradleNodeReport
import dev.nx.gradle.native.utils.createNodeForProject
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

class NodesPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.logger.info("Applying NodesPlugin to ${project.name}")

        val gradleNodeReport = project.objects.property(GradleNodeReport::class.java)

        gradleNodeReport.set(project.provider { createNodeForProject(project) })

        val createNodesTask: TaskProvider<CreateNodesTask> =
                project.tasks.register("createNodes", CreateNodesTask::class.java)

        createNodesTask.configure { task ->
            task.projectName.set(project.name)
            task.gradleNodeReport.set(gradleNodeReport)

            task.description = "Create nodes and dependencies for Nx"
            task.group = "Nx Custom"

            project.logger.info("Registered createNodes for ${project.name}")

            // ✅ Ensure all included builds are also processed
            project.gradle.includedBuilds.forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }
}
