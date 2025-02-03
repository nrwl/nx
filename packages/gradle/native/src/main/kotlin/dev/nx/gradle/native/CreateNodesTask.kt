package dev.nx.gradle.native

import org.gradle.api.DefaultTask
import java.io.File
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import java.nio.file.Path
import org.gradle.api.logging.Logger
import org.gradle.api.file.ProjectLayout
import javax.inject.Inject
import kotlin.io.path.Path
import java.nio.file.Files

/**
 * This task generates nodes, depedencies and external nodes for all projects int the workspace
 * For each project, it will generate a json file at outputDirectory/projectName+hash.json
 * Inputs:
 * - hash: hash to in the file name
 * - json: json going to be put the output file
 * - projectName: project name currently processing
 */
abstract class CreateNodesTask
@Inject constructor(private var projectLayout: ProjectLayout) : DefaultTask() {
    @Option(option = "hash", description = "hash adds to output file")
    @Input
    var hash: String = ""

    @get:Input
    abstract var json: String

    @get:Input
    abstract var projectName: String

    private var logger = getLogger()

    @TaskAction
    fun action() {
        logger.info("CreateNodes: using hash ${hash}")
        logger.info("CreateNodes: create file for ${projectName}")

        var buildDirectory = projectLayout.getBuildDirectory()
        var buildDirectoryFile: File = buildDirectory.getAsFile().get()
        if (!buildDirectoryFile.exists()) {
            Files.createDirectory(buildDirectoryFile.toPath())
        }

        var outputDirectory = buildDirectory.dir("nx").get()
        var outputDirectoryFile = outputDirectory.getAsFile()
        if (!outputDirectoryFile.exists()) {
            Files.createDirectory(outputDirectoryFile.toPath())
        }
        val file = outputDirectory.file("${projectName}${hash}.json").getAsFile()

        file.writeText(json)
        println(file.getPath())
    }
}
