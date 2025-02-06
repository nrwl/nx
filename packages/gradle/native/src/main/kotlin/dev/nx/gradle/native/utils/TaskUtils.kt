package dev.nx.gradle.native.utils

import dev.nx.gradle.native.data.*
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

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
    logger.info("CreateNodes: process $task for $projectRoot")
    val target = mutableMapOf<String, Any?>()
    target["cache"] = true // set cache to be always true
    target["parallelism"] = false // set parallelism always false

    // process inputs
    val inputs = getInputsForTask(task, projectRoot, workspaceRoot, externalNodes)
    if (inputs?.isEmpty() == false) {
        logger.info("${task}: processed ${inputs.size} inputs")
        target["inputs"] = inputs
    }

    // process outputs
    val outputs = getOutputsForTask(task, projectRoot, workspaceRoot)
    if (outputs?.isEmpty() == false) {
        logger.info("${task}: processed ${outputs.size} outputs")
        target["outputs"] = outputs
    }

    // process dependsOn
    val dependsOn = getDependsOnForTask(task)
    if (dependsOn?.isEmpty() == false) {
        logger.info("${task}: processed ${dependsOn.size} dependsOn")
        target["dependsOn"] = dependsOn
    }

    val gradlewCommand = getGradlewCommand()
    target["command"] = "$gradlewCommand ${projectBuildPath}:${task.name}"

    val metadata = getMetadata(task.description ?: "Run ${task.name}", projectBuildPath, task.name)
    target["metadata"] = metadata

    var cwd = System.getProperty("user.dir")
    if (cwd.startsWith(workspaceRoot)) {
        cwd = cwd.replace(workspaceRoot, ".")
    }
    target["options"] = mapOf(
            "cwd" to cwd
    )

    return target
}

const val testCiTargetGroup = "verification"

/**
 * Add atomized ci test targets
 * Going to loop through each test files and create a target for each
 * It is going to modify targets and targetGroups in place
 */
fun addTestCiTargets(
        testFiles: FileCollection,
        projectBuildPath: String,
        target: NxTarget,
        targets: NxTargets,
        targetGroups: TargetGroups,
        projectRoot: String,
        workspaceRoot: String
) {
    if (!targetGroups.contains(testCiTargetGroup)) { // add target group if not exist
        targetGroups[testCiTargetGroup] = mutableListOf()
    }
    val dependsOn = mutableListOf<Map<String, String>>()
    val gradlewCommand = getGradlewCommand()
    testFiles.filter { testFile ->
        val fileName = testFile.getName().split(".").first()
        val regex = ".*(Test)(s)?\\d*".toRegex() // find the files that match Test(any number) regex
        testFile.startsWith(workspaceRoot) && regex.matches(fileName)
    }.forEach { testFile ->
        val fileName = testFile.getName().split(".").first()
        val testCiTarget = target.toMutableMap()
        testCiTarget["command"] = "$gradlewCommand ${projectBuildPath}:test --tests $fileName"
        val metadata = getMetadata("Runs Gradle test $fileName in CI", projectBuildPath, "test")
        testCiTarget["metadata"] = metadata
        testCiTarget["cache"] = true
        testCiTarget["parallelism"] = false
        testCiTarget["inputs"] = arrayOf(replaceRootInPath(testFile.path, projectRoot, workspaceRoot))

        val targetName = "ci--${fileName}"
        targets[targetName] = testCiTarget
        targetGroups["verification"]?.add(targetName)
        dependsOn.add(
                mapOf(
                        "target" to targetName,
                        "projects" to "self",
                        "params" to "forward"
                )
        )

    }
    if (dependsOn.isNotEmpty()) {
        val testCiTarget = mutableMapOf<String, Any?>()
        val metadata = getMetadata("Runs Gradle Tests in CI", projectBuildPath, "test")
        testCiTarget["executor"] = "nx:noop"
        testCiTarget["metadata"] = metadata
        testCiTarget["dependsOn"] = dependsOn
        testCiTarget["cache"] = true
        testCiTarget["parallelism"] = false
        targets["ci"] = testCiTarget
        targetGroups[testCiTargetGroup]?.add("ci")
    }
}

fun getGradlewCommand(): String {
    val gradlewCommand: String
    val operatingSystem = System.getProperty("os.name").lowercase()
    gradlewCommand = if (operatingSystem.contains("win")) {
        ".\\gradlew.bat"
    } else {
        "./gradlew"
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
    return try {
        val mappedInputsIncludeExternal: MutableList<Any> = mutableListOf()
        val inputs = task.inputs
        val externalDependencies = mutableListOf<String>()
        inputs.sourceFiles.filter {
            it.exists()
        }.forEach { file ->
            val path: String = file.path
            // replace the absolute path to contain {projectRoot} or {workspaceRoot}
            val pathWithReplacedRoot = replaceRootInPath(path, projectRoot, workspaceRoot)
            if (pathWithReplacedRoot != null) { // if the path is inside workspace
                mappedInputsIncludeExternal.add((pathWithReplacedRoot))
            }
            // if the path is outside of workspace
            if (pathWithReplacedRoot == null && path.endsWith(".jar") && externalNodes != null) { // add it to external dependencies
                try {
                    val externalDep = getExternalDepFromInputFile(path, externalNodes)
                    externalDependencies.add(externalDep)
                } catch (e: Exception) {
                    task.logger.info("${task}: get external dependency error $e")
                }
            }
        }
        if (externalDependencies.isNotEmpty()) {
            mappedInputsIncludeExternal.add(mutableMapOf("externalDependencies" to externalDependencies))
        }
        if (mappedInputsIncludeExternal.isNotEmpty()) {
            return mappedInputsIncludeExternal
        }
        return null
    } catch (e: Exception) {
        // Log the error but don't fail the build
        task.logger.info("Error getting outputs for ${task.path}: ${e.message}")
        task.logger.debug("Stack trace:", e)
        null
    }
}

/**
 * Get outputs for task
 * @param task task to process
 * @return list of outputs file, will not include if output file is outside workspace, null if empty or an error occurred
 */
fun getOutputsForTask(
        task: Task,
        projectRoot: String,
        workspaceRoot: String
): List<String>? {
    return try {
        val outputs = task.outputs.files
        if (!outputs.isEmpty) {
            return outputs.mapNotNull { file ->
                val path: String = file.path
                replaceRootInPath(path, projectRoot, workspaceRoot)
            }
        }
        null
    } catch (e: Exception) {
        // Log the error but don't fail the build
        task.logger.info("Error getting outputs for ${task.path}: ${e.message}")
        task.logger.debug("Stack trace:", e)
        null
    }
}

/**
 * Get dependsOn for task, handling configuration timing safely
 * @param task task to process
 * @return list of dependsOn tasks, null if empty or an error occurred
 */
fun getDependsOnForTask(task: Task): List<String>? {
    return try {
        val dependsOn = task.taskDependencies.getDependencies(null)
        if (dependsOn.isNotEmpty()) {
            val dependsOnTasksNames = dependsOn.map { depTask ->
                val depProject = depTask.project
                "${depProject.name}:${depTask.name}"
            }
            return dependsOnTasksNames
        }
        null
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
                    "command" to "$gradlewCommand help --task ${projectBuildPath}:${taskName}"
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
    val nameKey = segments.last().replace(".jar", "")
    val hash = segments[segments.size - 2]
    val version = segments[segments.size - 3]
    val packageName = segments[segments.size - 4]
    val packageGroup = segments[segments.size - 5]

    val data = ExternalDepData(version, "${packageGroup}.${packageName}", hash)
    val node = ExternalNode("gradle", "gradle:${nameKey}", data)
    externalNodes["gradle:${nameKey}"] = node
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
