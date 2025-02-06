package dev.nx.gradle.native

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

class NodesPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.logger.info("Applying NodesPlugin to ${project.name}")

        // Register the task lazily, only configuring execution inputs
        val createNodesTask: TaskProvider<CreateNodesTask> =
                project.tasks.register("createNodesLocal", CreateNodesTask::class.java) { task ->
                    task.projectName.set(project.name)
                    task.projectRef.set(project) // Pass project reference for execution-time processing

                    task.description = "Create nodes and dependencies for Nx"
                    task.group = "Nx Custom"

                    task.logger.info("Registered createNodes for ${project.name}")

                    // Ensure all included builds are processed only once
                    project.gradle.includedBuilds.distinct().forEach { includedBuild ->
                        task.dependsOn(includedBuild.task(":createNodesLocal"))
                    }
                }

        // Add a finalizer task to ALWAYS print the file path
        project.tasks.register("createNodes") { task ->
            task.dependsOn(createNodesTask) // Ensure it runs AFTER createNodesTask

            task.description = "Print nodes report for Nx"
            task.group = "Nx Custom"

            task.doLast {
                val outputFile = createNodesTask.get().outputFile
                println(outputFile.path) // This will run even if createNodesTask is skipped
            }

            // Ensure all included builds are processed only once
            project.gradle.includedBuilds.distinct().forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }
}
