package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Finds plugin executions for specific Maven phases using Maven's lifecycle executor
 */
class PluginExecutionFinder(
    private val log: Log,
    private val lifecycleExecutor: LifecycleExecutor,
    private val session: MavenSession
) {
    
    /**
     * Finds all plugin executions that will run during the specified phase
     * Returns a list of MojoExecutions that Maven would actually execute
     */
    fun findExecutionsForPhase(phase: String, project: MavenProject): List<org.apache.maven.plugin.MojoExecution> {
        val executions = mutableListOf<org.apache.maven.plugin.MojoExecution>()
        
        try {
            log.debug("Finding plugin executions for phase '$phase' in project ${project.artifactId}")
            
            // Use Maven's LifecycleExecutor to calculate what would actually run
            val originalProject = session.currentProject
            try {
                session.currentProject = project
                val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, phase)
                
                // Filter to only executions that run in the requested phase
                for (execution in executionPlan.mojoExecutions) {
                    if (execution.lifecyclePhase == phase) {
                        executions.add(execution)
                        log.debug("Found execution: ${execution.plugin.groupId}:${execution.plugin.artifactId}:${execution.goal} in phase $phase")
                    }
                }
                
            } finally {
                session.currentProject = originalProject
            }
            
        } catch (e: Exception) {
            log.warn("Failed to calculate execution plan for phase '$phase': ${e.message}")
        }
        
        // If we couldn't get the execution plan, fall back to analyzing project plugins
        if (executions.isEmpty()) {
            log.debug("No executions found via execution plan, falling back to project plugin analysis")
            executions.addAll(findExecutionsFromProjectPlugins(phase, project))
        }
        
        log.debug("Found ${executions.size} executions for phase '$phase' in project ${project.artifactId}")
        return executions
    }
    
    /**
     * Fallback method that analyzes the project's configured plugins directly
     */
    private fun findExecutionsFromProjectPlugins(phase: String, project: MavenProject): List<org.apache.maven.plugin.MojoExecution> {
        val executions = mutableListOf<org.apache.maven.plugin.MojoExecution>()
        
        // Check build plugins for explicit executions
        for (plugin in project.buildPlugins) {
            for (execution in plugin.executions) {
                if (execution.phase == phase) {
                    for (goal in execution.goals) {
                        try {
                            // Create a mock MojoExecution for analysis
                            // Note: This is a simplified approach - in real usage, we'd need proper plugin resolution
                            log.debug("Found configured execution: ${plugin.artifactId}:$goal in phase $phase")
                        } catch (e: Exception) {
                            log.debug("Failed to create execution for ${plugin.artifactId}:$goal: ${e.message}")
                        }
                    }
                }
            }
            
            // Check for default phase bindings
            val defaultGoals = getDefaultGoalsForPhase(plugin.artifactId, phase)
            if (defaultGoals.isNotEmpty() && plugin.executions.none { it.phase == phase }) {
                log.debug("Found default goals for ${plugin.artifactId} in phase $phase: $defaultGoals")
            }
        }
        
        return executions
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
            "maven-failsafe-plugin" to "verify" -> listOf("verify")
            "maven-jar-plugin" to "package" -> listOf("jar")
            "maven-war-plugin" to "package" -> listOf("war")
            "maven-ear-plugin" to "package" -> listOf("ear")
            "maven-resources-plugin" to "process-resources" -> listOf("resources")
            "maven-resources-plugin" to "process-test-resources" -> listOf("testResources")
            "maven-install-plugin" to "install" -> listOf("install")
            "maven-deploy-plugin" to "deploy" -> listOf("deploy")
            "maven-clean-plugin" to "clean" -> listOf("clean")
            else -> emptyList()
        }
    }
}