package dev.nx.gradle.native

import java.util.*
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

class NodesPlugin : Plugin<Project> {
  override fun apply(project: Project) {
    project.logger.info("${Date()} Applying NodesPlugin to ${project.name}")

    val hashProperty = project.findProperty("hash")?.toString() ?: "default-hash"

    // Lazily register the task without forcing realization
    val createNodesTask: TaskProvider<CreateNodesTask> =
        project.tasks.register("createNodesLocal", CreateNodesTask::class.java) { task ->
          task.projectName.set(project.name)
          task.projectRef.set(project) // Pass project reference for execution-time processing
          task.hash.set(hashProperty)

          task.description = "Create nodes and dependencies for Nx"
          task.group = "Nx Custom"

          // Avoid logging during configuration phase
          task.doFirst { it.logger.info("${Date()} Running createNodesLocal for ${project.name}") }
        }

    // Ensure all included builds are processed only once using lazy evaluation
    project.gradle.includedBuilds.distinct().forEach { includedBuild ->
      createNodesTask.configure { it.dependsOn(includedBuild.task(":createNodesLocal")) }
    }

    // Ensure all subprojects are processed only once using lazy evaluation
    project.subprojects.distinct().forEach { subProject ->
      // Add a dependency on each subproject's createNodesLocal task
      createNodesTask.configure {
        it.dependsOn(subProject.tasks.matching { it.name == "createNodesLocal" })
      }
    }

    // Register a finalizer task lazily
    project.tasks.register("createNodes").configure { task ->
      task.dependsOn(createNodesTask) // Ensure it runs AFTER createNodesTask
      task.description = "Print nodes report for Nx"
      task.group = "Nx Custom"

      // Use lazy evaluation to avoid realizing the task early
      val outputFileProvider = createNodesTask.map { it.outputFile }

      task.doFirst { it.logger.info("${Date()} Running createNodes for ${project.name}") }

      task.doLast {
        println(outputFileProvider.get().path) // This ensures lazy evaluation
      }
    }

    // Ensure all included builds are processed only once using lazy evaluation
    project.gradle.includedBuilds.distinct().forEach { includedBuild ->
      project.tasks.named("createNodes").configure {
        it.dependsOn(includedBuild.task(":createNodes"))
      }
    }

    // Ensure all subprojects are processed only once using lazy evaluation
    project.subprojects.distinct().forEach { subProject ->
      project.tasks.named("createNodes").configure {
        it.dependsOn(subProject.tasks.matching { it.name == "createNodes" })
      }
    }
  }
}
