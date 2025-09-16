package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.nio.file.Paths

/**
 * Analyzer for a single Maven project structure to generate JSON for Nx integration
 * This is a simplified, per-project analyzer that doesn't require cross-project coordination
 */
class NxProjectAnalyzer(
    private val session: MavenSession,
    private val project: MavenProject,
    private val workspaceRoot: String,
    private val sharedLifecycleAnalyzer: NxTargetFactory,
    private val sharedTestClassDiscovery: TestClassDiscovery,
    private val mavenCommand: String
) {
    private val objectMapper = ObjectMapper()
    private val log: Logger = LoggerFactory.getLogger(NxProjectAnalyzer::class.java)


    /**
     * Analyzes the project and returns Nx project config
     */
    fun analyze(): Pair<String, ObjectNode>? {
        val startTime = System.currentTimeMillis()
        try {
            log.info("Starting analysis for project: ${project.artifactId}")

            val pathResolverStart = System.currentTimeMillis()
            val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath, session)
            val pathResolverTime = System.currentTimeMillis() - pathResolverStart
            log.info("PathResolver initialization took ${pathResolverTime}ms for project: ${project.artifactId}")


            // Calculate relative path from workspace root
            val pathCalculationStart = System.currentTimeMillis()
            val workspaceRootPath = Paths.get(workspaceRoot)
            val projectPath = project.basedir.toPath()
            val root = workspaceRootPath.relativize(projectPath).toString().replace('\\', '/')
            val projectName = "${project.groupId}.${project.artifactId}"
            val projectType = determineProjectType(project.packaging)
            val pathCalculationTime = System.currentTimeMillis() - pathCalculationStart
            log.info("Path calculation took ${pathCalculationTime}ms for project: ${project.artifactId}")

            // Create Nx project configuration
            val configCreationStart = System.currentTimeMillis()
            val nxProject = objectMapper.createObjectNode()
            nxProject.put("name", projectName)
            nxProject.put("root", root)
            nxProject.put("projectType", projectType)
            nxProject.put("sourceRoot", "${root}/src/main/java")
            val configCreationTime = System.currentTimeMillis() - configCreationStart
            log.info("Basic config creation took ${configCreationTime}ms for project: ${project.artifactId}")

            val targetAnalysisStart = System.currentTimeMillis()
            val (nxTargets, targetGroups) = sharedLifecycleAnalyzer.createNxTargets(mavenCommand, project)
            val targetAnalysisTime = System.currentTimeMillis() - targetAnalysisStart
            log.info("Target analysis took ${targetAnalysisTime}ms for project: ${project.artifactId}")

            nxProject.set<ObjectNode>("targets", nxTargets)

            // Project metadata including target groups
            val metadataStart = System.currentTimeMillis()
            val projectMetadata = objectMapper.createObjectNode()
            projectMetadata.put("targetGroups", targetGroups)
            nxProject.put("metadata", projectMetadata)

            // Tags
            val tags = objectMapper.createArrayNode()
            tags.add("maven:${project.groupId}")
            tags.add("maven:${project.packaging}")
            nxProject.put("tags", tags)
            val metadataTime = System.currentTimeMillis() - metadataStart
            log.info("Metadata and tags creation took ${metadataTime}ms for project: ${project.artifactId}")

            val totalTime = System.currentTimeMillis() - startTime
            log.info("Analyzed project: ${project.artifactId} at $root in ${totalTime}ms")

            return root to nxProject

        } catch (e: Exception) {
            log.error("Failed to analyze project ${project.artifactId}: ${e.message}", e)
            return null
        }
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
