package io.nx.gradle.native

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


data class GradleTargets(val targets: MutableMap<String, Any>, val targetGroups: MutableMap<String, MutableList<String>>)
data class Metadata(val targetGroups: MutableMap<String, MutableList<String>>, val technologies: Array<String>, val description: String?)
data class Node(val targets: MutableMap<String, Any>, val metadata: Metadata, val name: String)
data class Dependency(val source: String, val target: String, val sourceFile: String)
data class ExternalDepData(val version: String?, val packageName: String)
data class ExternalNode(var type: String?, val name: String, var data: ExternalDepData)
data class GradleNodesReport(val nodes: MutableMap<String, Node>, val dependencies: MutableSet<Dependency>, val externalNodes: MutableMap<String, ExternalNode>)


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
    abstract var currentProject: Project

    private var logger = getLogger()

    @TaskAction
    fun action() {
        val rootProjectDirectory = currentProject.getProjectDir()
        if (workspaceRoot == "") {
            // assign the workspace root to root project's path
            workspaceRoot = System.getProperty("user.dir")
        }
        if (outputDirectory == "") {
            outputDirectory = File(workspaceRoot, ".nx/cache").getPath()
        }

        val projectNodes = mutableMapOf<String, Node>()
        val externalNodes = mutableMapOf<String, ExternalNode>()
        var dependencies = mutableSetOf<Dependency>()
        val allProjects = currentProject.getAllprojects()
        allProjects.forEach { project ->
            logger.info("CreateNodes: get nodes and dependencies for ${project}")
            try {
                project.getConfigurations().forEach {
                    it.getAllDependencies().filter {
                        it is ExternalModuleDependency
                    }.forEach {
                        val data = ExternalDepData(it.getVersion(), "${it.getGroup()}.${it.name}")
                        val externalNode = ExternalNode("gradle", it.name, data)
                        externalNodes.put(it.name, externalNode)
                    }
                }
                logger.info("CreateNodes: get external deps for ${project}")

                // get dependencies of project
                getDependenciesForProject(project, dependencies, allProjects)
                logger.info("CreateNodes: get dependencies for ${project}")

                val gradleTargets = this.processTargetsForProject(project, workspaceRoot, rootProjectDirectory)
                var projectRoot = project.getProjectDir().getPath()
                val projectNode = Node(
                        gradleTargets.targets,
                        Metadata(gradleTargets.targetGroups, arrayOf("gradle"), project.getDescription()),
                        project.getName()
                )
                logger.info("CreateNodes: get nodes for ${projectRoot}")
                projectNodes.put(projectRoot, projectNode)
            } catch (e: Exception) {
                logger.info("CreateNodes: error ${e.toString()}")
            } // ignore errors
        }

        val gson = Gson()
        val json = gson.toJson(GradleNodesReport(projectNodes, dependencies, externalNodes))
        val file = File(outputDirectory, "${currentProject.name}${hash}.json")
        file.writeText(json)
        println(file)
    }

    fun processTargetsForProject(
            project: Project,
            workspaceRoot: String,
            rootProjectDirectory: File
    ): GradleTargets {
        val targets = mutableMapOf<String, Any>()
        val targetGroups = mutableMapOf<String, MutableList<String>>()
        val projectRoot = project.getProjectDir().getPath()

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

            val group: String? = task.getGroup();
            if (!group.isNullOrBlank()) {
                if (targetGroups.contains(group)) {
                    targetGroups.get(group)?.add(task.name)
                } else {
                    targetGroups.set(group, mutableListOf<String>(task.name))
                }
            }

            val inputs = task.getInputs().getSourceFiles()
            if (!inputs.isEmpty()) {
                target.put("inputs", inputs.mapNotNull { file ->
                    val path: String = file.getPath()
                    replaceRootInPath(path, projectRoot, workspaceRoot)
                })
                logger.info("    >> CreateNodes: process ${task} inputs")
            }

            try {
                val outputs = task.getOutputs().getFiles()
                if (!outputs.isEmpty()) {
                    target.put("outputs", outputs.mapNotNull { file ->
                        val path: String = file.getPath()
                        replaceRootInPath(path, projectRoot, workspaceRoot)
                    })
                    logger.info("    >> CreateNodes: process ${task} outputs")
                }
            } catch (e: Exception) {
                logger.info("CreateNodes: get outputs error ${e.toString()}")
            }

            try {
                val dependsOn = task.getTaskDependencies().getDependencies(task)
                if (!dependsOn.isEmpty()) {
                    target.put("dependsOn", dependsOn.map { depTask ->
                        val depProject = depTask.getProject()
                        if (depProject == project) {
                            depTask.name
                        }
                        "${depProject.name}:${depTask.name}"
                    })
                    logger.info("    >> CreateNodes: process task ${task} dependsOn")
                }
            } catch (e: Exception) {
                logger.info("CreateNodes: get dependsOn error ${e.toString()}")
            }

            var cwd = rootProjectDirectory.getPath()
            if (cwd.startsWith(workspaceRoot)) {
                cwd = cwd.replace(workspaceRoot, ".")
            }
            if (!cwd.isNullOrBlank()) {
                target.put("options", mapOf("cwd" to cwd))
            }

            if (task.name.startsWith("compileTest")) {
                addTestCiTarget(inputs, gradlewCommand, gradleProject, target, targets, targetGroups, projectRoot, workspaceRoot)
            }

            target.put("cache", true)
            target.put("command", "${gradlewCommand} ${gradleProject}${task.name}")

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
            targets: MutableMap<String, Any>,
            targetGroups: MutableMap<String, MutableList<String>>,
            projectRoot: String,
            workspaceRoot: String
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
            testCiTarget.put("inputs", arrayOf(replaceRootInPath(testFile.getPath(), projectRoot, workspaceRoot)))

            val targetName = "ci--${fileName}"
            logger.info("CreateNodes: Create test ci file ${targetName}")
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
            targets.put("ci", testCiTarget)
            targetGroups.get("verification")?.add("ci")
        }

    }
}

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
