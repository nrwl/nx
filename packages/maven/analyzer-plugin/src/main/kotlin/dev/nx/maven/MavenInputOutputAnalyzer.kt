package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager

/**
 * Modular Maven input/output analyzer using composition of focused components
 */
class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    workspaceRoot: String,
    private val log: Log,
    session: MavenSession,
    pluginManager: MavenPluginManager
) {
    
    // Modular components
    private val pluginDescriptorLoader = PluginDescriptorLoader(log, session, pluginManager)
    private val expressionResolver = MavenExpressionResolver(session, log)
    private val pathResolver = PathResolver(workspaceRoot)
    private val parameterAnalyzer = MojoParameterAnalyzer(log, expressionResolver, pathResolver)
    private val executionFinder = PluginExecutionFinder(log)
    
    /**
     * Result of cacheability analysis
     */
    data class CacheabilityDecision(
        val cacheable: Boolean, 
        val reason: String, 
        val inputs: ArrayNode, 
        val outputs: ArrayNode
    )
    
    /**
     * Analyzes the cacheability of a Maven phase for the given project
     */
    fun analyzeCacheability(phase: String, project: MavenProject): CacheabilityDecision {
        log.debug("Analyzing phase '$phase' for project ${project.artifactId}")
        
        val inputs = objectMapper.createArrayNode()
        val outputs = objectMapper.createArrayNode()
        var hasSideEffects = false
        
        // Always include POM as input
        inputs.add("{projectRoot}/pom.xml")
        
        // Find all plugin executions for this phase
        val executions = executionFinder.findExecutionsForPhase(phase, project)
        
        if (executions.isEmpty()) {
            return CacheabilityDecision(false, "No plugin executions found for phase '$phase'", inputs, outputs)
        }
        
        // Analyze each execution
        for ((plugin, goals) in executions) {
            try {
                val pluginDescriptor = pluginDescriptorLoader.loadPluginDescriptor(plugin, project)
                if (pluginDescriptor != null) {
                    for (goal in goals) {
                        val mojo = pluginDescriptor.getMojo(goal)
                        if (mojo != null) {
                            log.debug("Analyzing mojo ${plugin.artifactId}:$goal")
                            
                            // Check for side effects
                            if (parameterAnalyzer.isSideEffectMojo(mojo)) {
                                log.debug("Mojo ${plugin.artifactId}:$goal has side effects")
                                hasSideEffects = true
                            }
                            
                            // Analyze mojo parameters
                            parameterAnalyzer.analyzeMojo(mojo, project, inputs, outputs)
                        } else {
                            log.warn("Could not find mojo descriptor for goal: $goal in plugin: ${plugin.artifactId}")
                        }
                    }
                } else {
                    log.warn("Could not load plugin descriptor for ${plugin.artifactId}")
                    // Without mojo descriptor, we can't analyze properly
                    return CacheabilityDecision(false, "Plugin descriptor unavailable for ${plugin.artifactId}", inputs, outputs)
                }
            } catch (e: Exception) {
                log.warn("Failed to analyze plugin ${plugin.artifactId}: ${e.message}")
                return CacheabilityDecision(false, "Failed to analyze plugin ${plugin.artifactId}", inputs, outputs)
            }
        }
        
        // Final cacheability decision
        return when {
            hasSideEffects -> CacheabilityDecision(false, "Has side effects", inputs, outputs)
            inputs.size() <= 1 -> CacheabilityDecision(false, "No meaningful inputs", inputs, outputs) // Only pom.xml
            else -> CacheabilityDecision(true, "Deterministic", inputs, outputs)
        }
    }
}