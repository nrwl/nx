package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Analyzes Maven phases by examining the actual plugin parameters that execute during each phase
 * This provides accurate input/output detection based on what plugins actually read and write
 */
class PluginBasedAnalyzer(
    private val log: Log,
    private val session: MavenSession,
    private val lifecycleExecutor: LifecycleExecutor,
    private val pluginManager: MavenPluginManager,
    private val pathResolver: PathResolver
) {
    
    // Initialize component analyzers
    private val expressionResolver = MavenExpressionResolver(session, log)
    private val pluginExecutionFinder = PluginExecutionFinder(log, lifecycleExecutor, session)
    private val mojoParameterAnalyzer = MojoParameterAnalyzer(log, expressionResolver, pathResolver)
    
    /**
     * Analyzes a Maven phase by examining which plugins execute and their parameters
     */
    fun analyzePhaseInputsOutputs(phase: String, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode): Boolean {
        
        try {
            // Find all plugin executions that will run during this phase
            val executions = pluginExecutionFinder.findExecutionsForPhase(phase, project)
            
            if (executions.isEmpty()) {
                return false
            }
            
            // Analyze each plugin execution
            for (execution in executions) {
                try {
                    analyzePluginExecution(execution, project, inputs, outputs)
                } catch (e: Exception) {
                    // Silently skip failed executions
                }
            }
            
            return true
            
        } catch (e: Exception) {
            return false
        }
    }
    
    /**
     * Analyzes a specific plugin execution to extract inputs and outputs from its parameters
     */
    private fun analyzePluginExecution(
        execution: org.apache.maven.plugin.MojoExecution, 
        project: MavenProject, 
        inputs: ArrayNode, 
        outputs: ArrayNode
    ) {
        val plugin = execution.plugin
        val goal = execution.goal
        
        
        try {
            // Load plugin descriptor to get mojo information
            val pluginDescriptor = loadPluginDescriptor(plugin, project)
            if (pluginDescriptor == null) {
                return
            }
            
            // Find the specific mojo for this goal
            val mojo = pluginDescriptor.getMojo(goal)
            if (mojo == null) {
                return
            }
            
            // Analyze the mojo's parameters to find inputs and outputs
            mojoParameterAnalyzer.analyzeMojo(mojo, project, inputs, outputs)
            
        } catch (e: Exception) {
            // Silently skip failed plugin executions
        }
    }
    
    /**
     * Loads a plugin descriptor using Maven's plugin manager
     */
    private fun loadPluginDescriptor(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor? {
        return try {
            
            // Use Maven's plugin manager to load the plugin descriptor
            val descriptor = pluginManager.getPluginDescriptor(plugin, project.remotePluginRepositories, session.repositorySession)
            
            
            descriptor
            
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * Determines if a phase is cacheable based on the plugins that execute during it
     * Returns a detailed cacheability assessment with reasoning
     */
    fun isPhaseCacheable(phase: String, project: MavenProject): Boolean {
        return getCacheabilityAssessment(phase, project).cacheable
    }
    
    /**
     * Provides detailed cacheability assessment with reasoning
     */
    fun getCacheabilityAssessment(phase: String, project: MavenProject): CacheabilityAssessment {
        // Phases that have side effects are never cacheable
        val nonCacheablePhases = setOf("install", "deploy", "clean")
        if (nonCacheablePhases.contains(phase)) {
            return CacheabilityAssessment(
                cacheable = false,
                reason = "Phase '$phase' has inherent side effects",
                details = listOf("Phase involves installation or deployment operations")
            )
        }
        
        try {
            val executions = pluginExecutionFinder.findExecutionsForPhase(phase, project)
            
            if (executions.isEmpty()) {
                return CacheabilityAssessment(
                    cacheable = false,
                    reason = "No plugin executions found for phase '$phase'",
                    details = listOf("Cannot determine inputs/outputs without plugin executions")
                )
            }
            
            val details = mutableListOf<String>()
            var hasThreadSafetyIssues = false
            var hasAggregatorMojos = false
            
            // Check each mojo execution for cacheability factors
            for (execution in executions) {
                val pluginDescriptor = loadPluginDescriptor(execution.plugin, project)
                val mojo = pluginDescriptor?.getMojo(execution.goal)
                
                if (mojo != null) {
                    // Check for side effects
                    if (mojoParameterAnalyzer.isSideEffectMojo(mojo)) {
                        return CacheabilityAssessment(
                            cacheable = false,
                            reason = "Mojo ${mojo.goal} has side effects",
                            details = details + "Goal '${mojo.goal}' interacts with external systems or has non-deterministic behavior"
                        )
                    }
                    
                    // For now, we'll assume all mojos are thread-safe and non-aggregator
                    // These checks can be enhanced later if needed
                    
                    details.add("Analyzed goal '${mojo.goal}' - appears cacheable based on parameters")
                }
            }
            
            // Make final cacheability decision based on all factors
            val cacheable = !hasThreadSafetyIssues && !hasAggregatorMojos
            val reason = when {
                hasAggregatorMojos -> "Contains aggregator mojos with cross-project effects"
                hasThreadSafetyIssues -> "Contains non-thread-safe mojos"
                else -> "All mojos are cacheable based on parameter analysis"
            }
            
            return CacheabilityAssessment(
                cacheable = cacheable,
                reason = reason,
                details = details
            )
            
        } catch (e: Exception) {
            return CacheabilityAssessment(
                cacheable = false,
                reason = "Error analyzing phase cacheability: ${e.message}",
                details = listOf("Exception occurred during plugin analysis")
            )
        }
    }
    
    /**
     * Data class for detailed cacheability assessment
     */
    data class CacheabilityAssessment(
        val cacheable: Boolean,
        val reason: String,
        val details: List<String>
    )
}