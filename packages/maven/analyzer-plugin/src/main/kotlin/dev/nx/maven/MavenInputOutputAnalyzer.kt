package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager

/**
 * Simple Maven input/output analyzer using preloaded Maven data
 */
class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    workspaceRoot: String,
    private val log: Log,
    session: MavenSession,
    pluginManager: MavenPluginManager
) {
    
    // Simple components using existing classes
    private val pathResolver = PathResolver(workspaceRoot)
    private val preloadedAnalyzer = PreloadedPluginAnalyzer(log, session, pathResolver)
    
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
        log.info("Analyzing phase '$phase' for project ${project.artifactId}")
        log.info("Project coordinates: ${project.groupId}:${project.artifactId}:${project.version}")
        
        val inputs = objectMapper.createArrayNode()
        val outputs = objectMapper.createArrayNode()
        
        // Always include POM as input
        inputs.add("{projectRoot}/pom.xml")
        
        // Add dependentTasksOutputFiles to automatically include outputs from dependsOn tasks as inputs
        val dependentTasksOutputFiles = objectMapper.createObjectNode()
        dependentTasksOutputFiles.put("dependentTasksOutputFiles", "**/*")
        dependentTasksOutputFiles.put("transitive", true)
        inputs.add(dependentTasksOutputFiles)
        
        // Use Maven's preloaded data directly - much simpler and more reliable!
        val analyzed = preloadedAnalyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs)
        
        if (!analyzed) {
            log.info("No preloaded analysis available for phase: $phase")
            return CacheabilityDecision(false, "No analysis available for phase '$phase'", inputs, outputs)
        }
        
        log.info("Successfully analyzed phase '$phase' with ${inputs.size()} inputs and ${outputs.size()} outputs")
        
        // DEBUG: Log final inputs to see what's actually in the array
        log.info("Final inputs for ${project.artifactId}:$phase = ${inputs.toString()}")
        
        // Check for side effects based on phase
        val hasSideEffects = when (phase) {
            "install", "deploy", "clean" -> {
                log.info("Phase '$phase' has side effects - not cacheable")
                true
            }
            else -> false
        }
        
        // Final cacheability decision
        return when {
            hasSideEffects -> CacheabilityDecision(false, "Has side effects", inputs, outputs)
            inputs.size() <= 1 -> {
                log.info("Phase '$phase' has no meaningful inputs (only pom.xml) - not cacheable")
                CacheabilityDecision(false, "No meaningful inputs", inputs, outputs)
            }
            else -> {
                log.info("Phase '$phase' is cacheable with ${inputs.size()} inputs and ${outputs.size()} outputs")
                CacheabilityDecision(true, "Deterministic", inputs, outputs)
            }
        }
    }
}