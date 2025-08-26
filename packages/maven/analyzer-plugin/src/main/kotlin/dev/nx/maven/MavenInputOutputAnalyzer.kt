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
        log.info("Analyzing phase '$phase' for project ${project.artifactId}")
        if (phase == "verify") {
            log.info("*** VERIFY PHASE ANALYSIS STARTING ***")
        }
        
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
            // Fall back to preloaded analysis as backup
            log.info("Using fallback analysis for phase: $phase")
            val preloadedAnalyzer = PreloadedPluginAnalyzer(log, session, pathResolver)
            val fallbackAnalyzed = preloadedAnalyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs)
            
            if (!fallbackAnalyzed) {
                return CacheabilityDecision(false, "No analysis available for phase '$phase'", inputs, outputs)
            }
        }
        
        log.info("Analyzed phase '$phase': ${inputs.size()} inputs, ${outputs.size()} outputs")
        
        // Use enhanced plugin-based cacheability assessment
        val assessment = pluginAnalyzer.getCacheabilityAssessment(phase, project)
        log.debug("Cacheability assessment for phase '$phase': ${assessment.reason}")
        assessment.details.forEach { detail -> log.debug("  - $detail") }
        
        // Final cacheability decision with enhanced reasoning
        // Terminal output and status are always cacheable benefits, regardless of file outputs
        return when {
            !assessment.cacheable -> {
                CacheabilityDecision(false, assessment.reason, inputs, outputs)
            }
            else -> {
                // If the plugin assessment says it's cacheable, then it's cacheable
                // Terminal output and exit status caching is valuable even without file outputs
                CacheabilityDecision(true, "Cacheable: ${assessment.reason}", inputs, outputs)
            }
        }
    }
}