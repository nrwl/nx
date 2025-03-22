package dev.nx.gradle

import java.util.*
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

class NxProjectGraphReportPlugin : Plugin<Project> {
  override fun apply(project: Project) {
    project.logger.info("${Date()} Applying NxProjectGraphReportPlugin to ${project.name}")

    val hashProperty = project.findProperty("hash")?.toString() ?: "default-hash"

    // Lazily register the task without forcing realization
    val nxProjectReportTask: TaskProvider<NxProjectReportTask> =
        project.tasks.register("nxProjectReport", NxProjectReportTask::class.java) { task ->
          task.projectName.set(project.name)
          task.projectRef.set(project) // Pass project reference for execution-time processing
          task.hash.set(hashProperty)

          task.description = "Create Nx project report for ${project.name}"
          task.group = "Reporting"

          // Avoid logging during configuration phase
          task.doFirst { it.logger.info("${Date()} Running nxProjectReport for ${project.name}") }
        }

    // Ensure all included builds are processed only once using lazy evaluation
    project.gradle.includedBuilds.distinct().forEach { includedBuild ->
      nxProjectReportTask.configure { it.dependsOn(includedBuild.task(":nxProjectReport")) }
    }

    // Ensure all subprojects are processed only once using lazy evaluation
    project.subprojects.distinct().forEach { subProject ->
      // Add a dependency on each subproject's nxProjectReport task
      nxProjectReportTask.configure {
        it.dependsOn(subProject.tasks.matching { it.name == "nxProjectReport" })
      }
    }

    // Register a finalizer task lazily
    project.tasks.register("nxProjectGraph").configure { task ->
      task.dependsOn(nxProjectReportTask) // Ensure it runs AFTER nxProjectReportTask
      task.description = "Create Nx project graph for ${project.name}"
      task.group = "Reporting"

      // Use lazy evaluation to avoid realizing the task early
      val outputFileProvider = nxProjectReportTask.map { it.outputFile }

      task.doFirst { it.logger.info("${Date()} Running nxProjectGraph for ${project.name}") }

      task.doLast {
        println(outputFileProvider.get().path) // This ensures lazy evaluation
      }
    }

    // Ensure all included builds are processed only once using lazy evaluation
    project.gradle.includedBuilds.distinct().forEach { includedBuild ->
      project.tasks.named("nxProjectGraph").configure {
        it.dependsOn(includedBuild.task(":nxProjectGraph"))
      }
    }

    // Ensure all subprojects are processed only once using lazy evaluation
    project.subprojects.distinct().forEach { subProject ->
      project.tasks.named("nxProjectGraph").configure {
        it.dependsOn(subProject.tasks.matching { it.name == "nxProjectGraph" })
      }
    }
  }
}
