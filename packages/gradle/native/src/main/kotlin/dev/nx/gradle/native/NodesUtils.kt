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


/**
 * Get depended projects for current projects
 * It is going to modify the dependencies in place
 */
fun getDependenciesForProject(project: Project, allProjects: Set<Project>): MutableSet<Dependency> {
    var dependencies = mutableSetOf<Dependency>()
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
    return dependencies
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
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val projectRoot = project.getProjectDir().getPath()
    val workspaceRoot = workspaceRootInner(System.getProperty("user.dir"), System.getProperty("user.dir"))
    project.getLogger().info("Using workspace root ${workspaceRoot}")

    var projectBuildPath: String = project.getBuildTreePath() // get the build path of project e.g. :app, :utils:number-utils, :buildSrc
    if (projectBuildPath.endsWith(":")) { // root project is ":", manually remove last :
        projectBuildPath = projectBuildPath.dropLast(1)
    }

    val logger = project.getLogger()

    logger.info("${project}: process targets")

    var gradleProject = project.getBuildTreePath()
    if (!gradleProject.endsWith(":")) {
        gradleProject += ":"
    }

    project.getTasks().forEach { task ->
        try {
            // add task to target groups
            val group: String? = task.getGroup();
            if (!group.isNullOrBlank()) {
                if (targetGroups.contains(group)) {
                    targetGroups.get(group)?.add(task.name)
                } else {
                    targetGroups.set(group, mutableListOf<String>(task.name))
                }
            }

            val target = processTask(task, projectBuildPath, projectRoot, workspaceRoot, externalNodes)
            targets.put(task.name, target)

            if (task.name.startsWith("compileTest")) {
                addTestCiTargets(
                        task.getInputs().getSourceFiles(),
                        projectBuildPath,
                        target,
                        targets,
                        targetGroups,
                        projectRoot,
                        workspaceRoot
                )
            }
        } catch (e: Exception) {
            logger.info("${task}: process task error ${e.toString()}")
        }
    }

    return GradleTargets(
            targets,
            targetGroups,
            externalNodes
    );
}

