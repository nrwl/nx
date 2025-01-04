package io.nx.gradle.plugin

import org.gradle.api.Project
import org.gradle.api.Plugin

/**
 * A plugin to create nx targets
 */
class Nodes: Plugin<Project> {
    override fun apply(project: Project) {
        // Register a task
        project.tasks.register("createNodes", CreateNodesTask::class.java) { task ->
            task.setDescription("Create nodes and dependencies for Nx")
            task.setGroup("Nx Custom")
            // Run task for composite builds
            project.getGradle().includedBuilds.forEach { includedBuild ->
                task.dependsOn(includedBuild.task(":createNodes"))
            }
        }
    }
}
