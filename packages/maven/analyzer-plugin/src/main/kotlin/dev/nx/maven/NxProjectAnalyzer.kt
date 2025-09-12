package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.project.MavenProject
import java.nio.file.Paths

/**
 * Analyzer for a single Maven project structure to generate JSON for Nx integration
 * This is a simplified, per-project analyzer that doesn't require cross-project coordination
 */
class NxProjectAnalyzer(
    private val session: MavenSession,
    private val project: MavenProject,
    private val workspaceRoot: String,
    private val log: org.apache.maven.plugin.logging.Log,
    private val sharedLifecycleAnalyzer: MavenLifecycleAnalyzer,
    private val sharedTestClassDiscovery: TestClassDiscovery
) {
    private val objectMapper = ObjectMapper()


    /**
     * Analyzes the project and returns Nx project config
     */
    fun analyze(): Pair<String, ObjectNode>? {
        try {
            val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath, session)
            val mavenCommand = pathResolver.getMavenCommand()

            // Calculate relative path from workspace root
            val workspaceRootPath = Paths.get(workspaceRoot)
            val projectPath = project.basedir.toPath()
            val root = workspaceRootPath.relativize(projectPath).toString().replace('\\', '/')
            val projectName = "${project.groupId}.${project.artifactId}"
            val projectType = determineProjectType(project.packaging)

            // Create Nx project configuration
            val nxProject = objectMapper.createObjectNode()
            nxProject.put("name", projectName)
            nxProject.put("root", root)
            nxProject.put("projectType", projectType)
            nxProject.put("sourceRoot", "${root}/src/main/java")

            val (nxTargets, targetGroups) = createNxTargets(mavenCommand)
            nxProject.set<ObjectNode>("targets", nxTargets)

            // Project metadata including target groups
            val projectMetadata = objectMapper.createObjectNode()
            projectMetadata.put("targetGroups", targetGroups)
            nxProject.put("metadata", projectMetadata)

            // Tags
            val tags = objectMapper.createArrayNode()
            tags.add("maven:${project.groupId}")
            tags.add("maven:${project.packaging}")
            nxProject.put("tags", tags)

            log.info("Analyzed project: ${project.artifactId} at $root")

            return root to nxProject

        } catch (e: Exception) {
            log.error("Failed to analyze project ${project.artifactId}: ${e.message}", e)
            return null
        }
    }

    private fun createNxTargets(
        mavenCommand: String,
    ): Pair<ObjectNode, ObjectNode> {
        val nxTargets = objectMapper.createObjectNode()

        // Generate targets from discovered plugin goals
        val targetGroups = objectMapper.createObjectNode()

        val phaseTargets = sharedLifecycleAnalyzer.generatePhaseTargets(project, mavenCommand)
        val mavenPhasesGroup = objectMapper.createArrayNode()
        phaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target)
            mavenPhasesGroup.add(phase)
        }
        targetGroups.put("maven-phases", mavenPhasesGroup)

        val (goalTargets, goalGroups) = sharedLifecycleAnalyzer.generateGoalTargets(project, mavenCommand)

        goalTargets.forEach { (goal, target) ->
            nxTargets.set<ObjectNode>(goal, target)
        }
        goalGroups.forEach { (groupName, group) ->
            val groupArray = objectMapper.createArrayNode()
            group.forEach { goal -> groupArray.add(goal) }
            targetGroups.put(groupName, groupArray)
        }
        return Pair(nxTargets, targetGroups)
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
