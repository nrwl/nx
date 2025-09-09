package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import org.apache.maven.project.MavenProject

/**
 * Handles Maven dependency resolution and phase fallback logic
 */
class MavenDependencyResolver {

    // Maven lifecycle phases in order (fallback if no analysis data available)
    private val mavenPhases = listOf(
        "validate", "initialize", "generate-sources", "process-sources",
        "generate-resources", "process-resources", "compile", "process-classes",
        "generate-test-sources", "process-test-sources", "generate-test-resources",
        "process-test-resources", "test-compile", "process-test-classes", "test",
        "prepare-package", "package", "pre-integration-test", "integration-test",
        "post-integration-test", "verify", "install", "deploy"
    )

    fun getBestDependencyPhase(
        dependencyProjectName: String,
        requestedPhase: String,
        allProjects: List<MavenProject>,
        projectAnalyses: Map<String, JsonNode> = emptyMap()
    ): String {
        // Try to get available phases from analysis data first
        val analysis = projectAnalyses[dependencyProjectName]
        val availablePhases = if (analysis != null) {
            // Get phases from analysis data
            val phasesNode = analysis.get("phases")
            if (phasesNode != null && phasesNode.isObject) {
                phasesNode.fieldNames().asSequence().toSet()
            } else {
                getAvailablePhasesFallback(dependencyProjectName, allProjects)
            }
        } else {
            getAvailablePhasesFallback(dependencyProjectName, allProjects)
        }

        val requestedPhaseIndex = mavenPhases.indexOf(requestedPhase)

        // If the requested phase is available, use it
        if (availablePhases.contains(requestedPhase)) {
            return requestedPhase
        }

        // Otherwise, find the highest available phase that comes before the requested phase
        if (requestedPhaseIndex > 0) {
            for (i in requestedPhaseIndex - 1 downTo 0) {
                if (availablePhases.contains(mavenPhases[i])) {
                    return mavenPhases[i]
                }
            }
        }

        // If no earlier phase is available, use the earliest available phase
        return availablePhases.minByOrNull { mavenPhases.indexOf(it) } ?: requestedPhase
    }

    private fun getAvailablePhasesFallback(
        dependencyProjectName: String,
        allProjects: List<MavenProject>
    ): Set<String> {
        // Find the dependency project
        val depProject = allProjects.find { "${it.groupId}.${it.artifactId}" == dependencyProjectName }
        if (depProject == null) {
            return setOf("install") // Fallback to install if we can't find the project
        }

        // Get available phases based on packaging (fallback logic)
        val availablePhases = mutableSetOf<String>()

        when (depProject.packaging.lowercase()) {
            "jar", "war", "ear" -> {
                availablePhases.addAll(listOf("validate", "compile", "test", "package", "verify", "install", "deploy"))
            }
            "pom" -> {
                availablePhases.addAll(listOf("validate", "install", "deploy"))
            }
            "maven-plugin" -> {
                availablePhases.addAll(listOf("validate", "compile", "test", "package", "install", "deploy"))
            }
        }

        // Always add clean phase
        availablePhases.add("clean")

        return availablePhases
    }

    fun computeDependsOnForPhase(
        phase: String,
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>,
        projectAnalyses: Map<String, JsonNode> = emptyMap()
    ): List<String> {
        val dependsOn = mutableListOf<String>()

        // Child modules need their parent POM in the local repository
        val parent = mavenProject.parent
        if (parent != null) {
            val parentCoordinates = "${parent.groupId}:${parent.artifactId}"
            val parentProjectName = coordinatesToProjectName[parentCoordinates]
            if (parentProjectName != null) {
                dependsOn.add("$parentProjectName:install")
            }
        }

        return dependsOn
    }

}
