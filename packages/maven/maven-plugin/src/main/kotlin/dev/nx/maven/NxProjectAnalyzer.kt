package dev.nx.maven

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dev.nx.maven.targets.NxTargetFactory
import dev.nx.maven.utils.PathFormatter
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Analyzer for a single Maven project structure to generate JSON for Nx integration
 * This is a simplified, per-project analyzer that doesn't require cross-project coordination
 */
class NxProjectAnalyzer(
  private val project: MavenProject,
  private val workspaceRoot: File,
  private val nxTargetFactory: NxTargetFactory,
  private val coordinatesMap: Map<String, String>,
  private val pathFormatter: PathFormatter,
) {
  private val log: Logger = LoggerFactory.getLogger(NxProjectAnalyzer::class.java)

  /**
   * Analyzes the project and returns Nx project config
   */
  fun analyze(): ProjectAnalysis {
    val startTime = System.currentTimeMillis()
    log.info("Starting analysis for project: ${project.artifactId}")

    // Calculate relative path from workspace root
    // Canonicalize both paths to resolve symlinks (e.g., /tmp -> /private/tmp on macOS)
    val pathCalculationStart = System.currentTimeMillis()
    val canonicalWorkspaceRoot = workspaceRoot.canonicalFile
    val canonicalBasedir = project.basedir.canonicalFile
    val root = pathFormatter.normalizeRelativePath(canonicalBasedir.relativeTo(canonicalWorkspaceRoot).path)
    val projectName = "${project.groupId}:${project.artifactId}"
    val projectType = determineProjectType(project.packaging)
    val pathCalculationTime = System.currentTimeMillis() - pathCalculationStart
    log.info("Path calculation took ${pathCalculationTime}ms for project: ${project.artifactId} ($root)")

    // Create Nx project configuration
    val configCreationStart = System.currentTimeMillis()
    val nxProject = JsonObject()
    nxProject.addProperty("name", projectName)
    nxProject.addProperty("root", root)
    nxProject.addProperty("projectType", projectType)
    nxProject.addProperty("sourceRoot", "${root}/src/main/java")
    val configCreationTime = System.currentTimeMillis() - configCreationStart
    log.info("Basic config creation took ${configCreationTime}ms for project: ${project.artifactId}")

    val targetAnalysisStart = System.currentTimeMillis()
    val (nxTargets, targetGroups) = nxTargetFactory.createNxTargets(project)
    val targetAnalysisTime = System.currentTimeMillis() - targetAnalysisStart
    log.info("Target analysis took ${targetAnalysisTime}ms for project: ${project.artifactId}")

    nxProject.add("targets", nxTargets)

    // Project metadata including target groups
    val metadataStart = System.currentTimeMillis()
    val projectMetadata = JsonObject()
    projectMetadata.add("targetGroups", targetGroups)
    nxProject.add("metadata", projectMetadata)

    // Tags
    val tags = JsonArray()
    tags.add("maven:${project.groupId}")
    tags.add("maven:${project.packaging}")
    nxProject.add("tags", tags)
    val metadataTime = System.currentTimeMillis() - metadataStart
    log.info("Metadata and tags creation took ${metadataTime}ms for project: ${project.artifactId}")

    val totalTime = System.currentTimeMillis() - startTime
    log.info("Analyzed project: ${project.artifactId} at $root in ${totalTime}ms")


    log.info("Collecting dependencies for project: ${project.artifactId}")
    val dependencies = project.dependencies.mapNotNull { dependency ->
      coordinatesMap.get("${dependency.groupId}:${dependency.artifactId}")
    }.map { target ->
      NxDependency(
        NxDependencyType.Static,
        coordinatesMap.getValue(projectName),
        target,
        project.file
      )
    }.toMutableList()

    if (project.parent != null) {
      coordinatesMap.get("${project.parent.groupId}:${project.parent.artifactId}")?.let { parentPath ->
        dependencies.add(
          NxDependency(
            NxDependencyType.Static,
            coordinatesMap.getValue(projectName),
            parentPath,
            project.file
          )
        )
      }
    }

    val dependenciesJson = dependencies.map { nxDependency ->
      val dependency = JsonObject()

      dependency.addProperty("type", nxDependency.type.name.lowercase())
      dependency.addProperty("source", nxDependency.source)
      dependency.addProperty("target", nxDependency.target)
      dependency.addProperty("sourceFile", pathFormatter.normalizeRelativePath(nxDependency.sourceFile.canonicalFile.relativeTo(canonicalWorkspaceRoot).path))
      dependency
    }

    return ProjectAnalysis(project.file, root, nxProject, dependenciesJson)
  }

  private fun determineProjectType(packaging: String): String {
    return when (packaging.lowercase()) {
      "pom" -> "library"
      "jar", "war", "ear" -> "application"
      "maven-plugin" -> "library"
      else -> "library"
    }
  }
}

data class ProjectAnalysis(val pomFile: File, val root: String, val project: JsonElement, val dependencies: List<JsonElement>)

data class NxDependency(val type: NxDependencyType, val source: String, val target: String, val sourceFile: File)

enum class NxDependencyType {
  Implicit, Static, Dynamic
}
