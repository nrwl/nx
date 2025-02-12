package dev.nx.gradle.native.utils

import dev.nx.gradle.native.data.Dependency
import org.gradle.api.Project

private val dependencyCache = mutableMapOf<Project, Set<Dependency>>()

fun getDependenciesForProject(project: Project, allProjects: Set<Project>): Set<Dependency> {
    return dependencyCache.getOrPut(project) {
        val dependencies = mutableSetOf<Dependency>()
        val logger = project.logger
        val configurationsToCheck = listOf("compileClasspath", "implementationDependenciesMetadata")

        configurationsToCheck.forEach { configName ->
            val configuration = project.configurations.findByName(configName)
            if (configuration != null) {
                try {
                    val artifactView = configuration.incoming.artifactView { view ->
                        view.componentFilter { true }
                    }

                    artifactView.artifacts.forEach { artifact ->
                        val dependencyPath = artifact.file.path
                        val foundProject = allProjects.find { p -> dependencyPath.contains(p.name) }

                        if (foundProject != null) {
                            dependencies.add(
                                    Dependency(
                                            project.projectDir.path,
                                            foundProject.projectDir.path,
                                            project.buildFile.path
                                    )
                            )
                        }
                    }
                } catch (e: Exception) {
                    logger.info("Error checking configuration $configName for ${project.name}: ${e.message}")
                }
            } else {
                logger.info("Configuration $configName not found in project ${project.name}")
            }
        }

        // Include subprojects manually
        project.subprojects.forEach { childProject ->
            dependencies.add(
                    Dependency(
                            project.projectDir.path,
                            childProject.projectDir.path,
                            project.buildFile.path
                    )
            )
        }

        // Include included builds manually
        project.gradle.includedBuilds.forEach { includedBuild ->
            dependencies.add(
                    Dependency(
                            project.projectDir.path,
                            includedBuild.projectDir.path,
                            project.buildFile.path
                    )
            )
        }

        dependencies
    }
}
