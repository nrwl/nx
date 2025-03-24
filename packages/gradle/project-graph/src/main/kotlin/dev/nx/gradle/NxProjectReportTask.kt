package dev.nx.gradle

import com.google.gson.Gson
import dev.nx.gradle.utils.createNodeForProject
import java.io.File
import java.util.*
import javax.inject.Inject
import org.gradle.api.DefaultTask
import org.gradle.api.Project
import org.gradle.api.file.ProjectLayout
import org.gradle.api.provider.MapProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.*

@CacheableTask
abstract class NxProjectReportTask @Inject constructor(private val projectLayout: ProjectLayout) :
    DefaultTask() {

  companion object {
    private val gson = Gson()
  }

  @get:Input abstract val projectName: Property<String>

  @get:Input abstract val hash: Property<String>

  @get:Input abstract val cwd: Property<String>

  @get:Input abstract val workspaceRoot: Property<String>

  @get:Input abstract val targetNameOverrides: MapProperty<String, String>

  // Don't compute report at configuration time, move it to execution time
  @get:Internal // Prevent Gradle from caching this reference
  abstract val projectRef: Property<Project>

  @get:OutputFile
  val outputFile: File
    get() = projectLayout.buildDirectory.file("nx/${projectName.get()}.json").get().asFile

  @TaskAction
  fun action() {
    logger.info("${Date()} Apply task action NxProjectReportTask for ${projectName.get()}")
    logger.info("${Date()} Hash input: ${hash.get()}")
    logger.info("${Date()} Target Name Overrides ${targetNameOverrides.get()}")
    val project = projectRef.get() // Get project reference at execution time
    val report =
        createNodeForProject(
            project,
            targetNameOverrides.get(),
            workspaceRoot.get(),
            cwd.get()) // Compute report at execution time
    val reportJson = gson.toJson(report)

    if (outputFile.exists() && outputFile.readText() == reportJson) {
      logger.info("${Date()} No change in the node report for ${projectName.get()}")
      return
    }

    logger.info("${Date()} Writing node report for ${projectName.get()}")
    outputFile.writeText(reportJson)
  }
}
