package dev.nx.gradle

import com.google.gson.Gson
import dev.nx.gradle.utils.createNodeForProject
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter
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

  @get:Input abstract val workspaceRoot: Property<String>

  @get:Input abstract val atomized: Property<Boolean>

  @get:Input abstract val targetNameOverrides: MapProperty<String, String>

  @get:Input abstract val targetNamePrefix: Property<String>

  // Don't compute report at configuration time, move it to execution time
  @get:Internal // Prevent Gradle from caching this reference
  abstract val projectRef: Property<Project>

  init {
    atomized.convention(true)
    targetNamePrefix.convention("")
  }

  @get:OutputFile
  val outputFile: File
    get() = projectLayout.buildDirectory.file("nx/${projectName.get()}.json").get().asFile

  @TaskAction
  fun action() {
    logger.info("${Date()} Apply task action NxProjectReportTask for ${projectName.get()}")
    logger.info("${Date()} Hash input: ${hash.get()}")
    logger.info("${Date()} Target Name Overrides ${targetNameOverrides.get()}")
    logger.info("${Date()} Target Name Prefix: ${targetNamePrefix.get()}")
    logger.info("${Date()} Atomized: ${atomized.get()}")

    val project = projectRef.get()
    val report =
        createNodeForProject(
            project,
            targetNameOverrides.get(),
            workspaceRoot.get(),
            atomized.get(),
            targetNamePrefix.get())

    outputFile.parentFile.mkdirs()
    val tempFile = File(outputFile.parentFile, "${outputFile.name}.tmp")

    BufferedWriter(FileWriter(tempFile)).use { writer -> gson.toJson(report, writer) }

    val shouldUpdate =
        !outputFile.exists() ||
            tempFile.length() != outputFile.length() ||
            !filesHaveSameContent(tempFile, outputFile)

    if (shouldUpdate) {
      logger.info("${Date()} Writing node report for ${projectName.get()}")
      tempFile.renameTo(outputFile)
    } else {
      logger.info("${Date()} No change in the node report for ${projectName.get()}")
      tempFile.delete()
    }
  }

  private fun filesHaveSameContent(file1: File, file2: File): Boolean {
    if (file1.length() != file2.length()) return false

    file1.inputStream().buffered().use { is1 ->
      file2.inputStream().buffered().use { is2 ->
        val buffer1 = ByteArray(8192)
        val buffer2 = ByteArray(8192)
        while (true) {
          val read1 = is1.read(buffer1)
          val read2 = is2.read(buffer2)
          if (read1 != read2) return false
          if (read1 == -1) return true
          if (!buffer1.contentEquals(buffer2)) return false
        }
      }
    }
  }
}
