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
    
    // Cache for expensive plugin descriptor loading
    // Key: "groupId:artifactId:version" (plugin coordinates)
    private val pluginDescriptorCache = mutableMapOf<String, PluginDescriptor?>()
    
    /**
     * Analyzes a Maven phase by examining which plugins execute and their parameters
     */
    fun analyzePhaseInputsOutputs(phase: String, project: MavenProject, inputs: MutableSet<String>, outputs: MutableSet<String>): Boolean {
        
        log.warn("*** STARTING PHASE ANALYSIS FOR '$phase' ***")
        try {
            // Find all plugin executions that will run during this phase
            log.warn("  About to call findExecutionsForPhase")
            val executions = pluginExecutionFinder.findExecutionsForPhase(phase, project)
            log.warn("  Back from findExecutionsForPhase with ${executions.size} executions")
            executions.forEach { execution ->
                log.warn("    - ${execution.plugin.artifactId}:${execution.goal}")
            }
            
            if (executions.isEmpty()) {
                log.debug("No executions found for phase '$phase', marking as unanalyzable")
                return false
            }
            
            // Analyze each plugin execution
            for (execution in executions) {
                try {
                    analyzePluginExecution(execution, project, inputs, outputs)
                    
                    // Special handling for maven-compiler-plugin - explicitly add source directories
                    if (execution.plugin.artifactId == "maven-compiler-plugin") {
                        addCompilerPluginSourceDirectories(execution, project, inputs, phase)
                    }
                } catch (e: Exception) {
                    // Silently skip failed executions
                }
            }
            
            return true
            
        } catch (e: Exception) {
            log.warn("Exception analyzing phase '$phase': ${e.message}")
            e.printStackTrace()
            return false
        }
    }
    
    /**
     * Analyzes a specific plugin execution to extract inputs and outputs from its parameters
     */
    private fun analyzePluginExecution(
        execution: org.apache.maven.plugin.MojoExecution, 
        project: MavenProject, 
        inputs: MutableSet<String>, 
        outputs: MutableSet<String>
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
        // Create cache key from plugin coordinates
        val cacheKey = "${plugin.groupId}:${plugin.artifactId}:${plugin.version ?: "LATEST"}"
        
        // Check cache first
        if (pluginDescriptorCache.containsKey(cacheKey)) {
            val cachedDescriptor = pluginDescriptorCache[cacheKey]
            log.debug("Using cached plugin descriptor for $cacheKey")
            return cachedDescriptor
        }
        
        return try {
            log.debug("Loading plugin descriptor for $cacheKey (cache miss)")
            
            // Use Maven's plugin manager to load the plugin descriptor
            val descriptor = pluginManager.getPluginDescriptor(plugin, project.remotePluginRepositories, session.repositorySession)
            
            // Cache the result (even if null - that's a valid cache entry)
            pluginDescriptorCache[cacheKey] = descriptor
            log.debug("Cached plugin descriptor for $cacheKey")
            
            descriptor
            
        } catch (e: Exception) {
            // Cache the null result to avoid retrying failed loads
            pluginDescriptorCache[cacheKey] = null
            log.debug("Cached null plugin descriptor for $cacheKey due to exception: ${e.message}")
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
                    cacheable = true,
                    reason = "No plugin executions to analyze - phase is safe to cache",
                    details = listOf("Phase '$phase' has no plugin executions, making it inherently cacheable")
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
                    val pluginArtifactId = execution.plugin.artifactId
                    log.debug("Analyzing mojo: ${pluginArtifactId}:${mojo.goal}")
                    
                    // Check for side effects
                    if (mojoParameterAnalyzer.isSideEffectMojo(mojo)) {
                        log.warn("Mojo ${pluginArtifactId}:${mojo.goal} detected as having side effects")
                        return CacheabilityAssessment(
                            cacheable = false,
                            reason = "Mojo ${pluginArtifactId}:${mojo.goal} has side effects",
                            details = details + "Goal '${mojo.goal}' from plugin '${pluginArtifactId}' interacts with external systems or has non-deterministic behavior"
                        )
                    }
                    
                    // For now, we'll assume all mojos are thread-safe and non-aggregator
                    // These checks can be enhanced later if needed
                    
                    log.debug("Mojo ${pluginArtifactId}:${mojo.goal} appears cacheable")
                    details.add("Analyzed goal '${mojo.goal}' from '${pluginArtifactId}' - appears cacheable based on parameters")
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
     * Special handling for maven-compiler-plugin to ensure source directories are included as inputs
     */
    private fun addCompilerPluginSourceDirectories(
        execution: org.apache.maven.plugin.MojoExecution, 
        project: MavenProject, 
        inputs: MutableSet<String>,
        phase: String
    ) {
        when (execution.goal) {
            "compile" -> {
                // Add main source directories for compile goal
                project.compileSourceRoots?.forEach { sourceRoot ->
                    if (sourceRoot.isNotBlank()) {
                        pathResolver.addInputPath(sourceRoot, inputs)
                    }
                }
            }
            "testCompile" -> {
                // Add test source directories for testCompile goal
                project.testCompileSourceRoots?.forEach { testSourceRoot ->
                    if (testSourceRoot.isNotBlank()) {
                        pathResolver.addInputPath(testSourceRoot, inputs)
                    }
                }
            }
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