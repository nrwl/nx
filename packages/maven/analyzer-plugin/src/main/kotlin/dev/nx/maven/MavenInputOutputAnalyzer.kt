package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.lifecycle.LifecycleExecutor

/**
 * Maven input/output analyzer using plugin parameter analysis
 * Examines actual plugin parameters to determine what files each phase reads and writes
 */
class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    private val workspaceRoot: String,
    private val log: Log,
    private val session: MavenSession,
    private val pluginManager: MavenPluginManager,
    private val lifecycleExecutor: LifecycleExecutor
) {
    
    // Components will be created per-project to ensure correct path resolution
    
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
        log.debug("Analyzing phase '$phase' for project ${project.artifactId} using plugin parameter analysis")
        log.debug("Project coordinates: ${project.groupId}:${project.artifactId}:${project.version}")
        
        // Create project-specific path resolver to ensure {projectRoot} refers to project directory
        val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath)
        
        // Use the new plugin-based analyzer that examines actual plugin parameters
        val pluginAnalyzer = PluginBasedAnalyzer(log, session, lifecycleExecutor, pluginManager, pathResolver)
        
        val inputs = objectMapper.createArrayNode()
        val outputs = objectMapper.createArrayNode()
        
        // Let plugin parameter analysis determine ALL inputs - no hardcoded assumptions
        
        // Add dependentTasksOutputFiles to automatically include outputs from dependsOn tasks as inputs
        val dependentTasksOutputFiles = objectMapper.createObjectNode()
        dependentTasksOutputFiles.put("dependentTasksOutputFiles", "**/*")
        dependentTasksOutputFiles.put("transitive", true)
        inputs.add(dependentTasksOutputFiles)
        
        // Analyze the phase using plugin parameter examination
        val analyzed = pluginAnalyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs)
        
        if (!analyzed) {
            log.debug("No plugin parameter analysis available for phase: $phase")
            // Fall back to preloaded analysis as backup
            log.debug("Falling back to preloaded analysis for phase: $phase")
            val preloadedAnalyzer = PreloadedPluginAnalyzer(log, session, pathResolver)
            val fallbackAnalyzed = preloadedAnalyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs)
            
            if (!fallbackAnalyzed) {
                return CacheabilityDecision(false, "No analysis available for phase '$phase'", inputs, outputs)
            }
        }
        
        log.debug("Successfully analyzed phase '$phase' with ${inputs.size()} inputs and ${outputs.size()} outputs")
        
        // DEBUG: Log final inputs to see what's actually in the array
        log.debug("Final inputs for ${project.artifactId}:$phase = ${inputs.toString()}")
        
        // Use plugin-based cacheability check
        val hasSideEffects = !pluginAnalyzer.isPhaseCacheable(phase, project)
        
        // Final cacheability decision
        return when {
            hasSideEffects -> {
                log.debug("Phase '$phase' has side effects - not cacheable")
                CacheabilityDecision(false, "Has side effects", inputs, outputs)
            }
            inputs.size() <= 1 -> {
                log.debug("Phase '$phase' has no meaningful inputs (only dependentTasksOutputFiles) - not cacheable")
                CacheabilityDecision(false, "No meaningful inputs", inputs, outputs)
            }
            else -> {
                log.debug("Phase '$phase' is cacheable with ${inputs.size()} inputs and ${outputs.size()} outputs")
                CacheabilityDecision(true, "Deterministic based on plugin parameters", inputs, outputs)
            }
        }
    }
}