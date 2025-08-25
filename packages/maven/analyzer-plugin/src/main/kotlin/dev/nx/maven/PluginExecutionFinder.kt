package dev.nx.maven

import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Finds plugin executions for specific Maven phases
 */
class PluginExecutionFinder(
    private val log: Log
) {
    
    /**
     * Finds all plugin executions that should run during the specified phase
     * Returns a list of (plugin, goals) pairs
     */
    fun findExecutionsForPhase(phase: String, project: MavenProject): List<Pair<org.apache.maven.model.Plugin, List<String>>> {
        val results = mutableListOf<Pair<org.apache.maven.model.Plugin, List<String>>>()
        
        for (plugin in project.buildPlugins) {
            val goals = mutableListOf<String>()
            
            // Check explicit executions
            for (execution in plugin.executions) {
                if (execution.phase == phase) {
                    goals.addAll(execution.goals)
                }
            }
            
            // Check default phase bindings for plugins without explicit phase
            if (goals.isEmpty()) {
                val defaultGoals = getDefaultGoalsForPhase(plugin.artifactId, phase)
                goals.addAll(defaultGoals)
            }
            
            if (goals.isNotEmpty()) {
                results.add(plugin to goals)
            }
        }
        
        return results
    }
    
    /**
     * Returns the default goals that a plugin executes during a specific phase
     * Based on standard Maven plugin lifecycle bindings
     */
    private fun getDefaultGoalsForPhase(artifactId: String, phase: String): List<String> {
        return when (artifactId to phase) {
            "maven-compiler-plugin" to "compile" -> listOf("compile")
            "maven-compiler-plugin" to "test-compile" -> listOf("testCompile")
            "maven-surefire-plugin" to "test" -> listOf("test")
            "maven-failsafe-plugin" to "integration-test" -> listOf("integration-test")
            "maven-jar-plugin" to "package" -> listOf("jar")
            "maven-war-plugin" to "package" -> listOf("war")
            "maven-ear-plugin" to "package" -> listOf("ear")
            "maven-clean-plugin" to "clean" -> listOf("clean")
            "maven-install-plugin" to "install" -> listOf("install")
            "maven-deploy-plugin" to "deploy" -> listOf("deploy")
            else -> emptyList()
        }
    }
}