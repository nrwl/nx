package dev.nx.gradle.native

import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.file.FileCollection
import java.io.File

/**
 * Process a task and convert it into target
 * Going to populate:
 * - cache
 * - parallelism
 * - inputs
 * - outputs
 * - command
 * - metadata
 * - options with cwd and args
 */
fun processTask(
        task: Task,
        projectBuildPath: String,
        projectRoot: String,
        workspaceRoot: String,
        externalNodes: MutableMap<String, ExternalNode>
): MutableMap<String, Any?> {
    val logger = task.logger
    logger.info("  >> CreateNodes: process ${task} for ${projectRoot}")
    val target = mutableMapOf<String, Any?>()
    target.put("cache", true) // set cache to be always true
    target.put("parallelism", false) // set parallelism alaway false

    // process inputs
    val inputs = getInputsForTask(task, projectRoot, workspaceRoot, externalNodes)
    if (inputs?.isEmpty() == false) {
        logger.info("${task}: processed ${inputs?.size} inputs")
        target.put("inputs", inputs)
    }

    // process oputputs
    val outputs = getOutputsForTask(task, projectRoot, workspaceRoot)
    if (outputs?.isEmpty() == false) {
        logger.info("${task}: processed ${outputs?.size} outputs")
        target.put("outputs", outputs)
    }

    // process dependsOn
    val dependsOn = getDependsOnForTask(task)
    if (dependsOn?.isEmpty() == false) {
        logger.info("${task}: processed ${dependsOn?.size} dependsOn")
        target.put("dependsOn", dependsOn)
    }

    val gradlewCommand = getGradlewCommand()
    target.put("command", "${gradlewCommand} ${projectBuildPath}:${task.name}")

    val metadata = getMetadata(task.getDescription() ?: "Run ${task.getName()}", projectBuildPath, task.getName())
    target.put("metadata", metadata)

    var cwd = System.getProperty("user.dir")
    if (cwd.startsWith(workspaceRoot)) {
        cwd = cwd.replace(workspaceRoot, ".")
    }
    target.put("options", mapOf(
            "cwd" to cwd,
            "args" to "--configuration-cache --parallel --build-cache" // add these args to improve performance
    ))

    return target
}

const val testCiTargetGroup = "verfication"

/**
 * Add atomized ci test targets
 * Going to loop through each test files and create a target for each
 * It is going to modify targets and targetGroups in place
 * @param projectBuildPath current gradle project to add test ci targets
 * @param task compileTest task to be split up
 * @param targets targets to add ci test targets to, going to modify it in place
 * @param targetGroups targetsGroup to add newly created ci test targets
 */
fun addTestCiTargets(
        testFiles: FileCollection,
        projectBuildPath: String,
        target: Target,
        targets: Targets,
        targetGroups: TargetGroups,
        projectRoot: String,
        workspaceRoot: String
) {
    if (!targetGroups.contains(testCiTargetGroup)) { // add target group if not exist
        targetGroups.set(testCiTargetGroup, mutableListOf())
    }
    val dependsOn = mutableListOf<Map<String, String>>()
    val gradlewCommand = getGradlewCommand()
    testFiles.filter { testFile ->
        val fileName = testFile.getName().split(".").first()
        val regex = ".*(Test)(s)?\\d*".toRegex() // find the files that match Test(any number) regex
        testFile.startsWith(workspaceRoot) && regex.matches(fileName)
    }?.forEach { testFile ->
        val fileName = testFile.getName().split(".").first()
        val testCiTarget = target.toMutableMap()
        testCiTarget.put("command", "${gradlewCommand} ${projectBuildPath}:test --tests ${fileName}")
        val metadata = getMetadata("Runs Gradle test ${fileName} in CI", projectBuildPath, "test")
        testCiTarget.put("metadata", metadata)
        testCiTarget.put("cache", true)
        testCiTarget.put("parallelism", false)
        testCiTarget.put("inputs", arrayOf(replaceRootInPath(testFile.getPath(), projectRoot, workspaceRoot)))

        val targetName = "ci--${fileName}"
        targets.put(targetName, testCiTarget)
        targetGroups.get("verification")?.add(targetName)
        dependsOn.add(
                mapOf(
                        "target" to targetName,
                        "projects" to "self",
                        "params" to "forward"
                )
        )

    }
    if (!dependsOn.isEmpty()) {
        val testCiTarget = mutableMapOf<String, Any?>()
        val metadata = getMetadata("Runs Gradle Tests in CI", projectBuildPath, "test")
        testCiTarget.put("executor", "nx:noop")
        testCiTarget.put("metadata", metadata)
        testCiTarget.put("dependsOn", dependsOn)
        testCiTarget.put("cache", true)
        testCiTarget.put("parallelism", false)
        targets.put("ci", testCiTarget)
        targetGroups.get(testCiTargetGroup)?.add("ci")
    }
}

fun getGradlewCommand(): String {
    var gradlewCommand: String;
    val operSys = System.getProperty("os.name").lowercase();
    if (operSys.contains("win")) {
        gradlewCommand = ".\\gradlew.bat"
    } else {
        gradlewCommand = "./gradlew"
    }
    return gradlewCommand
}

/**
 * Parse task and get inputs for this task
 * @param task task to process
 * @return a list of inputs including external dependencies, null if empty or an error occurred
 */
fun getInputsForTask(
        task: Task,
        projectRoot: String,
        workspaceRoot: String,
        externalNodes: MutableMap<String, ExternalNode>?
): MutableList<Any>? {
    try {
        var mappedInputsIncludeExternal: MutableList<Any> = mutableListOf<Any>()
        val inputs = task.getInputs()
        val externalDependencies = mutableListOf<String>()
        inputs.getSourceFiles().filter {
            it.exists()
        }.forEach { file ->
            val path: String = file.getPath()
            // replace the absolute path to contain {projectRoot} or {workspaceRoot}
            val pathWithReplacedRoot = replaceRootInPath(path, projectRoot, workspaceRoot)
            if (pathWithReplacedRoot != null) { // if the path is inside workspace
                mappedInputsIncludeExternal.add((pathWithReplacedRoot))
            }
            // if the path is outside of workspace
            if (pathWithReplacedRoot == null && path.endsWith(".jar") && externalNodes != null) { // add it to external dependencies
                try {
                    val externalDep = getExternalDepFromInputFile(path, externalNodes)
                    externalDependencies.add(getExternalDepFromInputFile(path, externalNodes))
                } catch (e: Exception) {
                    task.logger.info("${task}: get external dependency error ${e.toString()}")
                }
            }
        }
        if (externalDependencies.isNotEmpty()) {
            mappedInputsIncludeExternal.add(mutableMapOf("externalDependencies" to externalDependencies))
        }
        if (!mappedInputsIncludeExternal.isEmpty()) {
            return mappedInputsIncludeExternal
        }
    } catch (e: Exception) {
        task.logger.info("${task}: get inputs error ${e.toString()}")
    }
    return null
}

/**
 * Get outputs for task
 * @param task task to process
 * @return list of outpus file, will not include if output file is outside workspace, null if empty or an error ocurred
 */
fun getOutputsForTask(
        task: Task,
        projectRoot: String,
        workspaceRoot: String
): List<String>? {
    try {
        val outputs = task.getOutputs().getFiles()
        if (!outputs.isEmpty()) {
            return outputs.mapNotNull { file ->
                val path: String = file.getPath()
                replaceRootInPath(path, projectRoot, workspaceRoot)
            }
        }
    } catch (e: Exception) {
        task.logger.info("${task}: get outputs error ${e.toString()}")
    }
    return null
}

/**
 * Get dependsOn for task, handling configuration timing safely
 * @param task task to process
 * @return list of dependsOn tasks, null if empty or an error occurred
 */
fun getDependsOnForTask(task: Task): List<String>? {
    return try {
        // Get the raw dependencies set without forcing evaluation
        val rawDependencies = task.dependsOn

        // Filter and process only the resolved tasks
        val resolvedDependencies = rawDependencies.mapNotNull { dep ->
            when (dep) {
                // Handle direct task references
                is Task -> "${dep.project.name}:${dep.name}"

                // Handle task providers (lazy task references)
                is TaskProvider<*> -> "${dep.get().project.name}:${dep.name}"

                // Handle string task paths
                is String -> {
                    // For cross-project task dependencies
                    if (dep.contains(":")) dep
                    // For same-project task dependencies
                    else "${task.project.name}:$dep"
                }

                // Ignore other dependency types
                else -> null
            }
        }

        // Return null if no dependencies found
        resolvedDependencies.takeIf { it.isNotEmpty() }

    } catch (e: Exception) {
        // Log the error but don't fail the build
        task.logger.info("Error getting dependencies for ${task.path}: ${e.message}")
        task.logger.debug("Stack trace:", e)
        null
    }
}

/**
 * Get metadata for task
 * @param description
 */
fun getMetadata(description: String?, projectBuildPath: String, taskName: String): Map<String, Any?> {
    val gradlewCommand = getGradlewCommand()
    return mapOf(
            "description" to description,
            "technologies" to arrayOf("gradle"),
            "help" to mapOf(
                    "command" to "${gradlewCommand} help --task ${projectBuildPath}:${taskName}"
            )
    )
}

/**
 * convert path org.apache.commons/commons-lang3/3.13.0/b7263237aa89c1f99b327197c41d0669707a462e/commons-lang3-3.13.0.jar
 * to external dep:
 *     "gradle:commons-lang3-3.13.0": {
 *       "type": "gradle",
 *       "name": "commons-lang3",
 *       "data": { "version": "3.13.0", "packageName": "org.apache.commons.commons-lang3",  "hash": "b7263237aa89c1f99b327197c41d0669707a462e",}
 *     }
 * @return key of external dep (e.g. gradle:commons-lang3-3.13.0)
 */
fun getExternalDepFromInputFile(inputFile: String, externalNodes: MutableMap<String, ExternalNode>): String {
    val segments: List<String> = inputFile.split("/")
    var nameKey = segments.last().replace(".jar", "")
    val hash = segments[segments.size - 2]
    val version = segments[segments.size - 3]
    val packageName = segments[segments.size - 4]
    val packageGroup = segments[segments.size - 5]

    val data = ExternalDepData(version, "${packageGroup}.${packageName}", hash)
    val node = ExternalNode("gradle", "gradle:${nameKey}", data)
    externalNodes.put("gradle:${nameKey}", node)
    return "gradle:${nameKey}"
}

/**
 * Going to replace the projectRoot with {projectRoot} and workspaceRoot with {workspaceRoot}
 * @return mapped path if inside workspace, null if outside workspace
 */
fun replaceRootInPath(p: String, projectRoot: String, workspaceRoot: String): String? {
    var path = p
    if (path.startsWith(projectRoot)) {
        path = path.replace(projectRoot, "{projectRoot}")
        return path
    } else if (path.startsWith(workspaceRoot)) {
        path = path.replace(workspaceRoot, "{workspaceRoot}")
        return path
    }
    return null
}
