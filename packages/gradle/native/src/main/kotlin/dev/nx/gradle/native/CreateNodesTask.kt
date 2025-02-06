package dev.nx.gradle.native

import com.google.gson.Gson
import org.gradle.api.DefaultTask
import java.io.File
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import org.gradle.api.file.ProjectLayout
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Nested
import javax.inject.Inject
import java.nio.file.Files

/**
 * This task generates nodes, dependencies and external nodes for all projects int the workspace
 * For each project, it will generate a json file at outputDirectory/projectName+hash.json
 * Inputs:
 * - hash: hash to in the file name
 * - json: json going to be put the output file
 * - projectName: project name currently processing
 */
abstract class CreateNodesTask
@Inject constructor(private var projectLayout: ProjectLayout) : DefaultTask() {
    @Option(option = "hash", description = "hash adds to output file name")
    @Input
    var hash: String = ""

    @get:Input
    abstract var projectName: String

    @get:Nested
    abstract val gradleNodeReport: Property<GradleNodeReport>

    @TaskAction
    fun action() {
        logger.info("CreateNodes: using hash $hash")
        logger.info("CreateNodes: create file for $projectName")

        val buildDirectory = projectLayout.buildDirectory
        val buildDirectoryFile: File = buildDirectory.asFile.get()
        if (!buildDirectoryFile.exists()) {
            Files.createDirectory(buildDirectoryFile.toPath())
        }

        val outputDirectory = buildDirectory.dir("nx").get()
        val outputDirectoryFile = outputDirectory.asFile
        if (!outputDirectoryFile.exists()) {
            Files.createDirectory(outputDirectoryFile.toPath())
        }
        val file = outputDirectory.file("${projectName}${hash}.json").asFile

        val gson = Gson()
        val json = gson.toJson(gradleNodeReport.get())
        file.writeText(json)
        println(file.path)
    }
}
