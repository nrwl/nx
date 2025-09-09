package dev.nx.maven

import org.apache.maven.project.MavenProject

/**
 * Handles Maven dependency resolution and phase fallback logic
 */
class MavenDependencyResolver {
    
    // Maven lifecycle phases in order
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
        allProjects: List<MavenProject>
    ): String {
        // Find the dependency project's available phases
        val depProject = allProjects.find { "${it.groupId}.${it.artifactId}" == dependencyProjectName }
        if (depProject == null) {
            return requestedPhase // Fallback to requested phase if we can't find the project
        }
        
        // Get available phases from the project's lifecycle
        val availablePhases = mutableSetOf<String>()
        
        // Add common phases based on packaging
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
    
    fun computeDependsOnForPhase(
        phase: String,
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>
    ): List<String> {
        val dependsOn = mutableListOf<String>()
        
        // Parent POMs are configuration only - no task dependencies needed
        // They must be available in the repository but don't need to "run" tasks
        
        // If this is a POM project, add dependencies on child modules
        if (mavenProject.packaging.lowercase() == "pom") {
            val currentProjectCoordinates = "${mavenProject.groupId}.${mavenProject.artifactId}"
            for (project in allProjects) {
                val parent = project.parent
                if (parent != null) {
                    val parentCoordinates = "${parent.groupId}.${parent.artifactId}"
                    val parentProjectName = coordinatesToProjectName[parentCoordinates]
                    if (parentProjectName == currentProjectCoordinates) {
                        // This project is a child of the current parent
                        val childProjectName = "${project.groupId}.${project.artifactId}"
                        val bestPhase = getBestDependencyPhase(childProjectName, phase, allProjects)
                        dependsOn.add("$childProjectName:$bestPhase")
                    }
                }
            }
        }

        // Add regular dependencies
        for (dependency in mavenProject.dependencies) {
            // Include compile, provided, test, and null scope dependencies for build ordering
            if (listOf("compile", "provided", "test", null).contains(dependency.scope)) {
                val depCoordinates = "${dependency.groupId}:${dependency.artifactId}"
                val depProjectName = coordinatesToProjectName[depCoordinates]
                if (depProjectName != null && depProjectName != "${mavenProject.groupId}.${mavenProject.artifactId}") {
                    val bestPhase = getBestDependencyPhase(depProjectName, phase, allProjects)
                    dependsOn.add("$depProjectName:$bestPhase")
                }
            }
        }
        
        return dependsOn
    }
}