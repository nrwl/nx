package dev.nx.gradle.native

import dev.nx.gradle.native.data.GradleNodeReport
import com.google.gson.Gson
import org.gradle.api.DefaultTask
import org.gradle.api.file.ProjectLayout
import org.gradle.api.provider.Property
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.*
import java.io.File
import javax.inject.Inject

abstract class CreateNodesTask @Inject constructor(private val projectLayout: ProjectLayout) : DefaultTask() {

    companion object {
        private val gson = Gson()
    }

    @Option(option = "hash", description = "Hash adds to output file name")
    @Input
    var hash: String = ""

    @get:Input
    abstract val projectName: Property<String>

    @get:Nested
    abstract val gradleNodeReport: Property<GradleNodeReport>

    @get:Input
    val reportJson: String
        get() = gson.toJson(gradleNodeReport.get())

    init {
        outputs.upToDateWhen { false } // Always run the task
    }
    @get:OutputFile
    val outputFile: File
        get() = projectLayout.buildDirectory.file("nx/${projectName.get()}${hash}.json").get().asFile

    @TaskAction
    fun action() {
        logger.info("CreateNodes: using hash $hash for ${projectName.get()}")
        outputFile.writeText(reportJson)
        println(outputFile.path)
    }
}
