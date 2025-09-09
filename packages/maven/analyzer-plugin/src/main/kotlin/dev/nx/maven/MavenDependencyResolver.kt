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
        
        // If this project has a parent, depend on the parent's install phase
        // This ensures the parent POM is available in the local repository
        val parent = mavenProject.parent
        if (parent != null) {
            val parentCoordinates = "${parent.groupId}:${parent.artifactId}"
            val parentProjectName = coordinatesToProjectName[parentCoordinates]
            if (parentProjectName != null) {
                // Always depend on parent's install phase for all phases except validate/initialize
                if (phase != "validate" && phase != "initialize") {
                    dependsOn.add("$parentProjectName:install")
                }
            }
        }
        
        // Add compile-time dependencies for phases that require compilation
        if (requiresCompileDependencies(phase, mavenProject, projectAnalyses)) {
            for (dependency in mavenProject.dependencies) {
                // Include compile, provided dependencies for compilation
                if (listOf("compile", "provided").contains(dependency.scope)) {
                    val depCoordinates = "${dependency.groupId}:${dependency.artifactId}"
                    val depProjectName = coordinatesToProjectName[depCoordinates]
                    if (depProjectName != null && depProjectName != "${mavenProject.groupId}.${mavenProject.artifactId}") {
                        // Dependencies should be installed so they're available for compilation
                        val bestPhase = getBestDependencyPhase(depProjectName, "install", allProjects, projectAnalyses)
                        dependsOn.add("$depProjectName:$bestPhase")
                    }
                }
            }
        }
        
        // If this project has child modules, add dependencies on them
        val currentProjectCoordinates = "${mavenProject.groupId}.${mavenProject.artifactId}"
        for (project in allProjects) {
            val childParent = project.parent
            if (childParent != null) {
                val childParentCoordinates = "${childParent.groupId}.${childParent.artifactId}"
                val childParentProjectName = coordinatesToProjectName[childParentCoordinates]
                if (childParentProjectName == currentProjectCoordinates) {
                    // This project is a child of the current parent
                    val childProjectName = "${project.groupId}.${project.artifactId}"
                    // Parent should depend on children's install phase to ensure they're in local repo
                    val bestPhase = getBestDependencyPhase(childProjectName, "install", allProjects, projectAnalyses)
                    dependsOn.add("$childProjectName:$bestPhase")
                }
            }
        }
        
        return dependsOn
    }
    
    /**
     * Determines if a phase requires compile-time dependencies based on analysis data
     */
    private fun requiresCompileDependencies(
        phase: String,
        mavenProject: MavenProject,
        projectAnalyses: Map<String, JsonNode>
    ): Boolean {
        val currentProjectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
        val analysis = projectAnalyses[currentProjectName]
        
        // If we have analysis data, check if the phase actually exists for this project
        if (analysis != null) {
            val phasesNode = analysis.get("phases")
            if (phasesNode != null && phasesNode.isObject) {
                // Only require dependencies if the phase exists and typically needs compilation
                val phaseExists = phasesNode.has(phase)
                if (!phaseExists) return false
                
                // Check if it's a compilation-related phase
                return when (phase) {
                    "compile", "test-compile", "test", "package", "verify", "install", "deploy" -> true
                    else -> false
                }
            }
        }
        
        // Fallback: use packaging type to determine if compilation phases are relevant
        return when (mavenProject.packaging.lowercase()) {
            "jar", "war", "ear", "maven-plugin" -> {
                when (phase) {
                    "compile", "test-compile", "test", "package", "verify", "install", "deploy" -> true
                    else -> false
                }
            }
            "pom" -> {
                // POM projects typically don't need compile dependencies for their limited phases
                when (phase) {
                    "install", "deploy" -> false  // Even install/deploy for POM don't need compile deps
                    else -> false
                }
            }
            else -> false
        }
    }
}