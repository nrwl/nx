package io.nx.gradle.plugin

import org.gradle.api.DefaultTask
import org.gradle.api.Project
import java.io.File
import org.gradle.api.tasks.options.Option
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import java.lang.Error
import java.nio.file.Path

data class GradleTargets(val targets: MutableMap<String, Any>, val targetGroups: MutableMap<String, MutableList<String>>)
data class Metadata(val targetGroups: MutableMap<String, MutableList<String>>, val technologies: Array<String>)
data class ProjectConfiguration(val targets: MutableMap<String, Any>, val metadata: Metadata, val name: String)
data class Dependency(val source: String, val target: String, val sourceFile: String)
data class Node(val project: ProjectConfiguration, val dependencies: MutableList<Dependency>)

abstract class CreateNodesTask : DefaultTask() {
    @Option(option = "outputDirectory", description = "Output directory, default to {workspaceRoot}/.nx/cache")
    @Input
    var outputDirectory: String = ""

    @Option(option = "workspaceRoot", description = "Workspace root, default to cwd")
    @Input
    var workspaceRoot: String = ""

    @TaskAction
    fun action() {
        val rootProjectDirectory = project.getProjectDir()
        if (workspaceRoot == "") {
            // assign the workspace root to root project's path
            workspaceRoot = System.getProperty("user.dir")
        }
        if (outputDirectory == "") {
            outputDirectory = File(workspaceRoot, ".nx/cache").getPath()
        }

        val projectNodes = mutableMapOf<String, Node>()
        project.getAllprojects().forEach { project ->
            try {
                // get dependencies of project
                var dependencies = mutableListOf<Dependency>();
                project.getChildProjects().forEach { childProject ->
                    dependencies.add(
                            Dependency(
                                    project.getProjectDir().getPath(),
                                    childProject.value.getProjectDir().getPath(),
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

                val gradleTargets = this.processTargetsForProject(project, workspaceRoot, rootProjectDirectory)
                var projectRoot = project.getProjectDir().getPath()
                val projectConfig = ProjectConfiguration(
                        gradleTargets.targets,
                        Metadata(gradleTargets.targetGroups, arrayOf("Gradle")),
                        project.getName()
                )
                projectNodes.put(projectRoot, Node(projectConfig, dependencies))
            } catch (e: Error) {
            } // ignore errors
        }
        val gson = Gson()
        val json = gson.toJson(projectNodes)
        val file = File(outputDirectory, "${project.name}.json")
        file.writeText(json)
        println(file)
    }

    fun processTargetsForProject(project: Project, workspaceRoot: String, rootProjectDirectory: File): GradleTargets {
        val targets = mutableMapOf<String, Any>();
        val targetGroups = mutableMapOf<String, MutableList<String>>();
        val projectRoot = project.getProjectDir().getPath()

        var command: String;
        val operSys = System.getProperty("os.name").lowercase();
        if (operSys.contains("win")) {
            command = ".\\gradlew.bat "
        } else {
            command = "./gradlew "
        }
        command += project.getBuildTreePath()
        if (!command.endsWith(":")) {
            command += ":"
        }

        project.getTasks().forEach { task ->
            val target = mutableMapOf<String, Any?>()
            val metadata = mutableMapOf<String, Any?>()
            var taskCommand = command.toString()
            metadata.put("description", task.getDescription())
            metadata.put("technologies", arrayOf("Gradle"))
            val group: String? = task.getGroup();
            if (!group.isNullOrBlank()) {
                if (targetGroups.contains(group)) {
                    targetGroups.get(group)?.add(task.name)
                } else {
                    targetGroups.set(group, mutableListOf<String>(task.name))
                }
            }

            var inputs = task.getInputs().getSourceFiles()
            if (!inputs.isEmpty()) {
                target.put("inputs", inputs.mapNotNull { file ->
                    val path: String = file.getPath()
                    replaceRootInPath(path, projectRoot, workspaceRoot)
                })
            }
            val outputs = task.getOutputs().getFiles()
            if (!outputs.isEmpty()) {
                target.put("outputs", outputs.mapNotNull { file ->
                    val path: String = file.getPath()
                    replaceRootInPath(path, projectRoot, workspaceRoot)
                })
            }
            target.put("cache", true)

            val dependsOn = task.getTaskDependencies().getDependencies(task)
            if (!dependsOn.isEmpty()) {
                target.put("dependsOn", dependsOn.map { depTask -> "${depTask.getProject().name}:${depTask.name}" })
            }
            target.put("metadata", metadata)

            taskCommand += task.name
            target.put("command", taskCommand)
            target.put("options", mapOf("cwd" to rootProjectDirectory.getPath()))

            targets.put(task.name, target)
        }

        return GradleTargets(
                targets,
                targetGroups
        );
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
