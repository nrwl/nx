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
        log.debug("Analyzing phase '$phase' using plugin parameter analysis for project ${project.artifactId}")
        
        try {
            // Find all plugin executions that will run during this phase
            val executions = pluginExecutionFinder.findExecutionsForPhase(phase, project)
            
            if (executions.isEmpty()) {
                log.debug("No plugin executions found for phase '$phase'")
                return false
            }
            
            log.debug("Found ${executions.size} plugin executions for phase '$phase'")
            
            // Analyze each plugin execution
            for (execution in executions) {
                try {
                    analyzePluginExecution(execution, project, inputs, outputs)
                } catch (e: Exception) {
                    log.debug("Failed to analyze plugin execution ${execution.plugin.artifactId}:${execution.goal}: ${e.message}")
                }
            }
            
            log.debug("Completed plugin parameter analysis for phase '$phase': ${inputs.size()} inputs, ${outputs.size()} outputs")
            return true
            
        } catch (e: Exception) {
            log.debug("Failed to analyze phase '$phase' using plugin parameters: ${e.message}")
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
        
        log.debug("Analyzing plugin execution: ${plugin.groupId}:${plugin.artifactId}:${plugin.version}:$goal")
        
        try {
            // Load plugin descriptor to get mojo information
            val pluginDescriptor = loadPluginDescriptor(plugin, project)
            if (pluginDescriptor == null) {
                log.debug("Could not load plugin descriptor for ${plugin.artifactId}")
                return
            }
            
            // Find the specific mojo for this goal
            val mojo = pluginDescriptor.getMojo(goal)
            if (mojo == null) {
                log.debug("Could not find mojo '$goal' in plugin ${plugin.artifactId}")
                return
            }
            
            log.debug("Found mojo: ${mojo.implementation} with ${mojo.parameters?.size ?: 0} parameters")
            
            // Analyze the mojo's parameters to find inputs and outputs
            mojoParameterAnalyzer.analyzeMojo(mojo, project, inputs, outputs)
            
        } catch (e: Exception) {
            log.debug("Failed to analyze plugin execution ${plugin.artifactId}:$goal: ${e.message}")
        }
    }
    
    /**
     * Loads a plugin descriptor using Maven's plugin manager
     */
    private fun loadPluginDescriptor(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor? {
        return try {
            log.debug("Loading plugin descriptor for ${plugin.groupId}:${plugin.artifactId}:${plugin.version}")
            
            // Use Maven's plugin manager to load the plugin descriptor
            val descriptor = pluginManager.getPluginDescriptor(plugin, project.remotePluginRepositories, session.repositorySession)
            
            if (descriptor != null) {
                log.debug("Successfully loaded plugin descriptor for ${plugin.artifactId} with ${descriptor.mojos?.size ?: 0} mojos")
            } else {
                log.debug("Plugin descriptor was null for ${plugin.artifactId}")
            }
            
            descriptor
            
        } catch (e: Exception) {
            log.debug("Failed to load plugin descriptor for ${plugin.artifactId}: ${e.message}")
            null
        }
    }
    
    /**
     * Determines if a phase is cacheable based on the plugins that execute during it
     */
    fun isPhaseCacheable(phase: String, project: MavenProject): Boolean {
        // Phases that have side effects are never cacheable
        val nonCacheablePhases = setOf("install", "deploy", "clean")
        if (nonCacheablePhases.contains(phase)) {
            return false
        }
        
        try {
            val executions = pluginExecutionFinder.findExecutionsForPhase(phase, project)
            
            // Check if any of the executing mojos have side effects
            for (execution in executions) {
                val pluginDescriptor = loadPluginDescriptor(execution.plugin, project)
                val mojo = pluginDescriptor?.getMojo(execution.goal)
                
                if (mojo != null && mojoParameterAnalyzer.isSideEffectMojo(mojo)) {
                    log.debug("Phase '$phase' is not cacheable due to side-effect mojo: ${execution.plugin.artifactId}:${execution.goal}")
                    return false
                }
            }
            
            return true
            
        } catch (e: Exception) {
            log.debug("Failed to determine cacheability for phase '$phase': ${e.message}")
            return false
        }
    }
}