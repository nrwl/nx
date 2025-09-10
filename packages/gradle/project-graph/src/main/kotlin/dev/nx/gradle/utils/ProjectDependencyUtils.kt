package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import org.gradle.api.Project
import org.gradle.api.artifacts.Configuration
import org.gradle.api.artifacts.ProjectDependency

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

    // Resolve every resolvable configuration (generic)
    project.configurations
        .matching { it.isCanBeResolved }
        .forEach { conf ->
            dependencies += dependenciesFromConfiguration(project, conf, sourcePath, sourceFilePath)
        }

    return dependencies
}

private fun dependenciesFromConfiguration(
    project: Project,
    conf: Configuration,
    sourcePath: String,
    sourceFilePath: String
): Set<Dependency> {
    val dependencies = mutableSetOf<Dependency>()
    
    try {
        conf.dependencies.forEach { dependency ->
            if (dependency is ProjectDependency) {
                val dependentProject = dependency.dependencyProject
                
                // Only add dependency if the target project has a valid project directory
                // and exists as an actual Gradle project in the repository
                if (dependentProject.projectDir.exists() && 
                    dependentProject.buildFile.exists()) {
                    
                    val targetPath = dependentProject.projectDir.absolutePath
                    
                    dependencies.add(
                        Dependency(
                            source = sourcePath,
                            target = targetPath,
                            sourceFile = sourceFilePath
                        )
                    )
                }
            }
        }
    } catch (e: Exception) {
        // Log the error but don't fail the build
        project.logger.debug("Error processing configuration ${conf.name}: ${e.message}")
    }
    
    return dependencies
}
