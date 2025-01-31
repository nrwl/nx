package dev.nx.gradle.native

import org.gradle.api.DefaultTask
import org.gradle.api.Project
import org.gradle.api.file.FileCollection
import java.io.File
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import org.gradle.api.artifacts.ProjectDependency
import org.gradle.api.artifacts.ExternalModuleDependency
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import java.nio.file.Path
import org.gradle.api.logging.Logger
import java.lang.Exception

data class GradleTargets(val targets: MutableMap<String, MutableMap<String, Any?>>, val targetGroups: MutableMap<String, MutableList<String>>)
data class Metadata(val targetGroups: MutableMap<String, MutableList<String>>, val technologies: Array<String>, val description: String?)
data class Node(val targets: MutableMap<String, MutableMap<String, Any?>>, val metadata: Metadata, val name: String)
data class Dependency(val source: String, val target: String, val sourceFile: String)
data class ExternalDepData(val version: String?, val packageName: String, val hash: String?)
data class ExternalNode(var type: String?, val name: String, var data: ExternalDepData)
data class GradleNodesReport(val nodes: MutableMap<String, Node>, val dependencies: MutableSet<Dependency>, var externalNodes: MutableMap<String, ExternalNode>)

/**
 * convert path org.apache.commons/commons-lang3/3.13.0/b7263237aa89c1f99b327197c41d0669707a462e/commons-lang3-3.13.0.jar
 * to external dep:
 *     "gradle:commons-lang3-3.13.0": {
 *       "type": "gradle",
 *       "name": "commons-lang3",
 *       "data": { "version": "3.13.0", "packageName": "org.apache.commons.commons-lang3",  "hash": "b7263237aa89c1f99b327197c41d0669707a462e",}
 *     }
 * @return key of t external dep
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
 * Get depended projects for current projects
 * It is going to modify the dependencies in place
 */
fun getDependenciesForProject(project: Project, dependencies: MutableSet<Dependency>, allProjects: Set<Project>) {
    project.getConfigurations().filter { config ->
        val configName = config.name
        configName == "compileClasspath" || configName == "implementationDependenciesMetadata"
    }.forEach {
        it.getAllDependencies().filter {
            it is ProjectDependency
        }.forEach {
            val foundProject = allProjects.find { p -> p.getName() == it.getName() }
            if (foundProject != null) {
                dependencies.add(
                        Dependency(
                                project.getProjectDir().getPath(),
                                foundProject.getProjectDir().getPath(),
                                project.getBuildFile().getPath()
                        )
                )
            }
        }
    }
    project.getSubprojects().forEach { childProject ->
        dependencies.add(
                Dependency(
                        project.getProjectDir().getPath(),
                        childProject.getProjectDir().getPath(),
                        project.getBuildFile().getPath()
                )
        )
    }
    project.getGradle().includedBuilds.forEach { includedBuild ->
        dependencies.add(
                Dependency(
                        project.getProjectDir().getPath(),
                        includedBuild.getProjectDir().getPath(),
                        project.getBuildFile().getPath()
                )
        )
    }
}

/**
 * Going to replace the projectRoot with {projectRoot} and workspaceRoot with {workspaceRoot}
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

/**
 * Process targets for project
 * @return targets and targetGroups
 */
fun processTargetsForProject(
        project: Project,
): GradleTargets {
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val projectRoot = project.getProjectDir().getPath()
    val logger = project.getLogger()

    logger.info("CreateNodes: process targets for ${projectRoot}")

    var gradlewCommand: String;
    val operSys = System.getProperty("os.name").lowercase();
    if (operSys.contains("win")) {
        gradlewCommand = ".\\gradlew.bat"
    } else {
        gradlewCommand = "./gradlew"
    }
    var gradleProject = project.getBuildTreePath()
    if (!gradleProject.endsWith(":")) {
        gradleProject += ":"
    }

    project.getTasks().forEach { task ->
        logger.info("  >> CreateNodes: process ${task} for ${projectRoot}")
        val target = mutableMapOf<String, Any?>()
        target.put("cache", true)

        val group: String? = task.getGroup();
        if (!group.isNullOrBlank()) {
            if (targetGroups.contains(group)) {
                targetGroups.get(group)?.add(task.name)
            } else {
                targetGroups.set(group, mutableListOf<String>(task.name))
            }
        }

        val inputs = task.getInputs().getSourceFiles()
        val externalDependencies = mutableListOf<String>()
        if (!inputs.isEmpty()) {
            val mappedInputs = inputs.mapNotNull { file ->
                val path: String = file.getPath()
                path
            }
            target.put("inputs", mappedInputs)
            logger.info("    >> CreateNodes: process ${task} inputs")
        }

        try {
            val outputs = task.getOutputs().getFiles()
            if (!outputs.isEmpty()) {
                val mappedOutputs: MutableList<String> = outputs.mapNotNull { file ->
                    val path: String = file.getPath()
                    path
                }.toMutableList()
                target.put("outputs", mappedOutputs)
                logger.info("    >> CreateNodes: process ${task} outputs")
            }
        } catch (e: Exception) {
            logger.info("CreateNodes: get outputs error ${e.toString()}")
        }

        try {
            val dependsOn = task.getTaskDependencies().getDependencies(task)
            if (!dependsOn.isEmpty()) {
                val dependsOnTasksNames = dependsOn.map { depTask ->
                    val depProject = depTask.getProject()
                    if (depProject == project) {
                        depTask.name
                    }
                    "${depProject.name}:${depTask.name}"
                }
                target.put("dependsOn", dependsOnTasksNames)
                logger.info("    >> CreateNodes: process task ${task} dependsOn")
            }
        } catch (e: Exception) {
            logger.info("CreateNodes: get dependsOn error ${e.toString()}")
        }

        if (task.name.startsWith("compileTest")) {
            addTestCiTarget(inputs, gradlewCommand, gradleProject, target, targets, targetGroups)
        }

        target.put("command", "${gradlewCommand} ${gradleProject}${task.name} --configuration-cache")
        target.put("parallelism", false)

        val metadata = mapOf(
                "description" to task.getDescription(),
                "technologies" to arrayOf("gradle"),
                "help" to mapOf(
                        "command" to "${gradlewCommand} help --task ${gradleProject}${task.name}"
                )
        )
        target.put("metadata", metadata)

        targets.put(task.name, target)
    }

    return GradleTargets(
            targets,
            targetGroups
    );
}


fun addTestCiTarget(
        testFiles: FileCollection,
        gradlewCommand: String,
        gradleProject: String,
        target: MutableMap<String, Any?>,
        targets: MutableMap<String, MutableMap<String, Any?>>,
        targetGroups: MutableMap<String, MutableList<String>>
) {
    if (testFiles.isEmpty()) {
        return
    }
    if (!targetGroups.contains("verification")) {
        targetGroups.set("verification", mutableListOf())
    }
    val dependsOn = mutableListOf<Map<String, String>>()
    testFiles.filter { testFile ->
        val fileName = testFile.getName().split(".").first()
        val regex = ".*(Test)(s)?\\d*".toRegex()
        regex.matches(fileName)
    }.forEach { testFile ->
        val fileName = testFile.getName().split(".").first() // remove file extension

        val metadata = mapOf(
                "description" to "Runs Gradle test ${fileName} in CI",
                "technologies" to arrayOf("gradle"),
                "help" to mapOf(
                        "command" to "${gradlewCommand} help --task ${gradleProject}test"
                )
        )

        val testCiTarget = target.toMutableMap()
        testCiTarget.put("command", "${gradlewCommand} ${gradleProject}test --tests ${fileName}")
        testCiTarget.put("metadata", metadata)
        testCiTarget.put("cache", true)
        testCiTarget.put("inputs", arrayOf(testFile.getPath()))

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
        val testCiTarget = target.toMutableMap()
        val metadata = mapOf(
                "description" to "Runs Gradle Tests in CI",
                "technologies" to arrayOf("gradle"),
                "help" to mapOf(
                        "command" to "${gradlewCommand} help --task ${gradleProject}test"
                )
        )
        testCiTarget.put("executor", "nx:noop")
        testCiTarget.remove("command")
        testCiTarget.put("metadata", metadata)
        testCiTarget.put("dependsOn", dependsOn)
        testCiTarget.put("cache", true)
        targets.put("ci", testCiTarget)
        targetGroups.get("verification")?.add("ci")
    }

}
