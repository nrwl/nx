package dev.nx.gradle.native

import org.gradle.api.DefaultTask
import java.io.File
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import java.nio.file.Path
import org.gradle.api.logging.Logger
import java.util.ArrayList
import java.util.UUID

abstract class CreateNodesTask : DefaultTask() {
    @Option(option = "outputDirectory", description = "Output directory, default to {workspaceRoot}/.nx/cache")
    @Input
    var outputDirectory: String = ""

    @Option(option = "workspaceRoot", description = "Workspace root, default to cwd")
    @Input
    var workspaceRoot: String = ""

    @Option(option = "hash", description = "hash adds to output file")
    @Input
    var hash: String = ""

    @get:Input
    abstract var gradleNodesReport: GradleNodesReport

    @get:Input
    abstract var projectName: String

    private var logger = getLogger()

    @TaskAction
    fun action() {
        if (workspaceRoot.isBlank()) {
            // assign the workspace root to root project's path
            workspaceRoot = System.getProperty("user.dir")
        }
        if (outputDirectory.isBlank()) {
            outputDirectory = File(workspaceRoot, ".nx/cache").getPath()
        }
        if (hash.isBlank()) {
            hash = UUID.randomUUID().hashCode().toString()
        }

        logger.info("CreateNodes: using workspaceRoot ${workspaceRoot}")
        logger.info("CreateNodes: using outputDirectory ${outputDirectory}")
        logger.info("CreateNodes: using hash ${hash}")

        gradleNodesReport.nodes.entries.forEach { (projectRoot, node) ->
            node.targets.values.forEach { target ->
                if (target.containsKey("inputs")) {
                    @Suppress("UNCHECKED_CAST")
                    var inputs = target.get("inputs") as? ArrayList<String>
                    var mappedInputs = mapInputs(inputs, projectRoot, workspaceRoot, gradleNodesReport.externalNodes)
                    target.put("inputs", mappedInputs)
                }

                if (target.containsKey("outputs")) {
                    @Suppress("UNCHECKED_CAST")
                    var outputs = target.get("outputs") as? ArrayList<String>
                    var mappedOutputs = mapOutputs(outputs, projectRoot, workspaceRoot)
                    target.put("outputs", mappedOutputs)
                }

                var cwd = System.getProperty("user.dir")
                if (cwd.startsWith(workspaceRoot)) {
                    cwd = cwd.replace(workspaceRoot, ".")
                }
                target.put("options", mapOf(
                        "cwd" to cwd,
                        "args" to "--configuration-cache"
                ))
            }
        }

        val gson = Gson()
        val json = gson.toJson(gradleNodesReport)
        val file = File(outputDirectory, "${projectName}${hash}.json")
        file.writeText(json)
        logger.quiet(file.getPath())
    }

    /**
     * Replace projectRoot and workspaceRoot, extract externalDependencies in the inputs path
     * Loops through inputs and replace the path with projectRoot and workspaceRoot
     * Going to add the externalNodes directly
     */
    fun mapInputs(inputs: ArrayList<String>?, projectRoot: String, workspaceRoot: String, externalNodes: MutableMap<String, ExternalNode>): MutableList<Any> {
        val externalDependencies = mutableListOf<String>()
        val mappedInputs = mutableListOf<Any>()
        inputs?.forEach { path ->
            val pathWithReplacedRoot = replaceRootInPath(path, projectRoot, workspaceRoot)
            if (pathWithReplacedRoot == null) {
                if (path.endsWith(".jar")) {
                    externalDependencies.add(getExternalDepFromInputFile(path, externalNodes))
                }
            } else {
                mappedInputs.add(pathWithReplacedRoot)
            }
        }
        if (externalDependencies.isNotEmpty()) {
            mappedInputs!!.add(mutableMapOf("externalDependencies" to externalDependencies))
        }
        return mappedInputs
    }

    /**
     * Replace projectRoot and workspaceRoot in outputs path
     * Not going to include the file out of workspace directory
     */
    fun mapOutputs(outputs: ArrayList<String>?, projectRoot: String, workspaceRoot: String): List<String>? {
        val mappedOutputs = outputs?.mapNotNull { path ->
            replaceRootInPath(path, projectRoot, workspaceRoot)
        }
        return mappedOutputs
    }
}




