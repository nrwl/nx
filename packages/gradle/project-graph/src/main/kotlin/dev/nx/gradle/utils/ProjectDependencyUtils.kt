package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import org.gradle.api.Project

private val dependencyCache = mutableMapOf<Project, Set<Dependency>>()

fun getDependenciesForProject(project: Project): MutableSet<Dependency> {
  return dependencyCache
      .getOrPut(project) { buildDependenciesForProject(project) }
      .toMutableSet() // Return a new mutable copy to prevent modifying the cached set
}

private fun buildDependenciesForProject(project: Project): Set<Dependency> {
  val dependencies = mutableSetOf<Dependency>()

  // Include subprojects manually
  project.subprojects.forEach { childProject ->
    val buildFilePath = if (project.buildFile.exists()) project.buildFile.path else null
    if (buildFilePath != null) {
      dependencies.add(
          Dependency(project.projectDir.path, childProject.projectDir.path, buildFilePath))
    }
  }

  // Include included builds manually
  project.gradle.includedBuilds.forEach { includedBuild ->
    val buildFilePath = if (project.buildFile.exists()) project.buildFile.path else null
    if (buildFilePath != null) {
      dependencies.add(
          Dependency(project.projectDir.path, includedBuild.projectDir.path, buildFilePath))
    }
  }

  return dependencies
}
