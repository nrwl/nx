package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import org.gradle.api.Project
import org.gradle.api.internal.artifacts.result.DefaultResolvedDependencyResult
import org.gradle.internal.component.local.model.DefaultProjectComponentSelector

private val dependencyCache = mutableMapOf<Project, Set<Dependency>>()

fun getDependenciesForProject(project: Project): MutableSet<Dependency> {
    return dependencyCache
        .getOrPut(project) { buildDependenciesForProject(project) }
        .toMutableSet() // Return a new mutable copy to prevent modifying the cached set
}

private fun buildDependenciesForProject(project: Project): Set<Dependency> {
    val dependencies = mutableSetOf<Dependency>()

    val sourcePath = project.projectDir.absolutePath
    val sourceFilePath = project.buildFile.takeIf { it.exists() }?.absolutePath ?: ""

    project.configurations
        .matching { it.isCanBeResolved }
        .forEach { conf ->
            try {
                conf.incoming.resolutionResult.allDependencies.forEach { dependency ->
                    if (dependency is DefaultResolvedDependencyResult) {
                        val requested = dependency.requested
                        if (requested is DefaultProjectComponentSelector) {
                            val dependentProject =
                                project.findProject(requested.toIdentifier().projectPath)

                            if (
                                dependentProject != null &&
                                    dependentProject.projectDir.exists() &&
                                    dependentProject.buildFile.exists()
                            ) {

                                val targetPath = dependentProject.projectDir.absolutePath

                                dependencies.add(
                                    Dependency(
                                        source = sourcePath,
                                        target = targetPath,
                                        sourceFile = sourceFilePath,
                                    )
                                )
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Log the error but don't fail the build
                project.logger.debug("Error processing configuration ${conf.name}: ${e.message}")
            }
        }

    return dependencies
}
