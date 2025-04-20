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

          val cwdProperty =
              project.findProperty("cwd")?.toString()
                  ?: run {
                    project.logger.warn(
                        "No 'cwd' property was provided for $project. Using default hash value: ${System.getProperty("user.dir")}")
                    System.getProperty("user.dir")
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
          task.cwd.set(cwdProperty)
          task.workspaceRoot.set(workspaceRootProperty)

          task.description = "Create Nx project report for ${project.name}"
          task.group = "Reporting"

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

    project.tasks.register("nxProjectGraph").configure { task ->
      task.dependsOn(nxProjectReportTask)
      task.description = "Create Nx project graph for ${project.name}"
      task.group = "Reporting"

      val outputFileProvider = nxProjectReportTask.map { it.outputFile }

      task.doFirst { it.logger.info("${Date()} Running nxProjectGraph for ${project.name}") }

      task.doLast { println(outputFileProvider.get().path) }
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
