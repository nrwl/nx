package dev.nx.gradle

import java.util.*
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.TaskProvider

class NxProjectGraphReportPlugin : Plugin<Project> {
  override fun apply(project: Project) {
    project.logger.info("${Date()} Applying NxProjectGraphReportPlugin to ${project.name}")

    val nxProjectReportTask: TaskProvider<NxProjectReportTask> =
        project.tasks.register("nxProjectReport", NxProjectReportTask::class.java) { task ->
          val hashProperty =
              project.findProperty("hash")?.toString()
                  ?: run {
                    project.logger.warn(
                        "No 'hash' property was provided for $project. Using default hash value: 'default-hash'")
                    "default-hash"
                  }

          val workspaceRootProperty =
              project.findProperty("workspaceRoot")?.toString()
                  ?: run {
                    project.logger.warn(
                        "No 'workspaceRoot' property was provided for $project. Using default hash value: ${System.getProperty("user.dir")}")
                    System.getProperty("user.dir")
                  }

          val targetNameOverrides: Map<String, String> =
              project.properties
                  .filterKeys { it.endsWith("TargetName") }
                  .mapValues { it.value.toString() }

          task.projectName.set(project.name)
          task.projectRef.set(project)
          task.hash.set(hashProperty)
          task.targetNameOverrides.set(targetNameOverrides)
          task.workspaceRoot.set(workspaceRootProperty)

          task.description = "Create Nx project report for ${project.name}"
          task.group = "Reporting"

          task.doFirst { it.logger.info("${Date()} Running nxProjectReport for ${project.name}") }

          // Configure dependencies during configuration phase
          project.gradle.includedBuilds.distinct().forEach { includedBuild ->
            task.dependsOn(includedBuild.task(":nxProjectReport"))
          }

          project.subprojects.distinct().forEach { subProject ->
            task.dependsOn(subProject.tasks.matching { it.name == "nxProjectReport" })
          }
        }

    val nxProjectGraphTask =
        project.tasks.register("nxProjectGraph") { task ->
          task.dependsOn(nxProjectReportTask)
          task.description = "Create Nx project graph for ${project.name}"
          task.group = "Reporting"

          val outputFileProvider = nxProjectReportTask.map { it.outputFile }

          task.doFirst { it.logger.info("${Date()} Running nxProjectGraph for ${project.name}") }

          task.doLast { println(outputFileProvider.get().path) }

          // Configure dependencies during configuration phase
          project.gradle.includedBuilds.distinct().forEach { includedBuild ->
            task.dependsOn(includedBuild.task(":nxProjectGraph"))
          }

          project.subprojects.distinct().forEach { subProject ->
            task.dependsOn(subProject.tasks.matching { it.name == "nxProjectGraph" })
          }
        }
  }
}
