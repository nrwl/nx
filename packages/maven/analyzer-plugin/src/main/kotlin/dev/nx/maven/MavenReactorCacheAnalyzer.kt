package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.lifecycle.internal.MojoExecutor
import org.apache.maven.model.Plugin
import org.apache.maven.plugin.MojoExecution
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Analyzes Maven Reactor execution plans to determine cacheability dynamically
 */
class MavenReactorCacheAnalyzer(
    private val session: MavenSession,
    private val lifecycleExecutor: LifecycleExecutor,
    private val objectMapper: ObjectMapper,
    private val log: Log
) {
    
    /**
     * Determine if a Maven phase is cacheable by examining the actual mojo executions
     */
    fun isPhaseExecutionCacheable(phase: String, mavenProject: MavenProject): CacheabilityResult {
        return try {
            log.debug("Analyzing cacheability for phase: $phase in project: ${mavenProject.artifactId}")
            
            // Get the execution plan for this phase
            val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, phase)
            val mojoExecutions = executionPlan.mojoExecutions
            
            // Analyze each mojo execution in this phase
            val analysis = analyzeMojoExecutions(mojoExecutions, phase)
            
            log.debug("Phase $phase cacheability: ${analysis.cacheable} (${analysis.reason})")
            analysis
            
        } catch (e: Exception) {
            log.warn("Failed to analyze phase $phase for cacheability", e)
            CacheabilityResult(
                cacheable = false,
                reason = "Analysis failed: ${e.message}"
            )
        }
    }
    
    private fun analyzeMojoExecutions(executions: List<MojoExecution>, phase: String): CacheabilityResult {
        if (executions.isEmpty()) {
            return CacheabilityResult(
                cacheable = false,
                reason = "No mojo executions found for phase"
            )
        }
        
        val mojoAnalyses = executions.map { execution ->
            analyzeSingleMojoExecution(execution)
        }
        
        // If any mojo is not cacheable, the whole phase is not cacheable
        val nonCacheable = mojoAnalyses.find { !it.cacheable }
        if (nonCacheable != null) {
            return CacheabilityResult(
                cacheable = false,
                reason = "Contains non-cacheable mojo: ${nonCacheable.reason}",
                mojoAnalyses = mojoAnalyses
            )
        }
        
        // All mojos are cacheable, so the phase is cacheable
        return CacheabilityResult(
            cacheable = true,
            reason = "All mojos are cacheable",
            mojoAnalyses = mojoAnalyses
        )
    }
    
    private fun analyzeSingleMojoExecution(execution: MojoExecution): MojoAnalysis {
        val descriptor = execution.mojoDescriptor
        val goal = "${execution.plugin.artifactId}:${execution.goal}"
        
        log.debug("Analyzing mojo: $goal")
        
        // Check for known non-cacheable patterns
        val nonCacheableCheck = checkKnownNonCacheablePatterns(descriptor, execution)
        if (nonCacheableCheck != null) {
            return nonCacheableCheck
        }
        
        // Analyze mojo parameters for input/output patterns
        val parameterAnalysis = analyzeParameters(descriptor)
        
        // Analyze plugin characteristics
        val pluginAnalysis = analyzePlugin(execution.plugin)
        
        // Combine analyses to determine cacheability
        return combineAnalyses(goal, parameterAnalysis, pluginAnalysis)
    }
    
    private fun checkKnownNonCacheablePatterns(descriptor: MojoDescriptor, execution: MojoExecution): MojoAnalysis? {
        val goal = "${execution.plugin.artifactId}:${execution.goal}"
        
        // Known non-cacheable goals that modify external state
        val knownNonCacheable = mapOf(
            "maven-install-plugin:install" to "Modifies local repository",
            "maven-deploy-plugin:deploy" to "Modifies remote repository", 
            "maven-clean-plugin:clean" to "Destructive file operations",
            "maven-release-plugin" to "Modifies SCM and external state",
            "exec-maven-plugin:exec" to "External command execution",
            "sql-maven-plugin" to "Database modifications"
        )
        
        knownNonCacheable.entries.find { goal.contains(it.key) }?.let { (pattern, reason) ->
            return MojoAnalysis(
                goal = goal,
                cacheable = false,
                reason = reason,
                evidence = listOf("Known non-cacheable pattern: $pattern")
            )
        }
        
        return null
    }
    
    private fun analyzeParameters(descriptor: MojoDescriptor): ParameterAnalysis {
        val parameters = descriptor.parameters ?: emptyList()
        val evidence = mutableListOf<String>()
        
        var hasInputs = false
        var hasOutputs = false
        var hasNetworkParams = false
        var hasFileSystemWrite = false
        
        for (parameter in parameters) {
            val paramName = parameter.name?.lowercase() ?: continue
            val paramType = parameter.type ?: ""
            
            // Look for input-like parameters
            if (paramName.contains("input") || paramName.contains("source") || 
                paramName.contains("resource") || paramType.contains("File") && paramName.contains("src")) {
                hasInputs = true
                evidence.add("Has input parameter: ${parameter.name}")
            }
            
            // Look for output-like parameters
            if (paramName.contains("output") || paramName.contains("target") || 
                paramName.contains("destination") || paramName.contains("directory")) {
                hasOutputs = true
                evidence.add("Has output parameter: ${parameter.name}")
            }
            
            // Look for network-related parameters
            if (paramName.contains("url") || paramName.contains("server") || 
                paramName.contains("repository") || paramName.contains("remote")) {
                hasNetworkParams = true
                evidence.add("Has network parameter: ${parameter.name}")
            }
            
            // Look for file system write operations
            if (paramName.contains("delete") || paramName.contains("clean") || 
                paramName.contains("remove")) {
                hasFileSystemWrite = true
                evidence.add("Has file system write parameter: ${parameter.name}")
            }
        }
        
        return ParameterAnalysis(
            hasInputs = hasInputs,
            hasOutputs = hasOutputs,
            hasNetworkParams = hasNetworkParams,
            hasFileSystemWrite = hasFileSystemWrite,
            evidence = evidence
        )
    }
    
    private fun analyzePlugin(plugin: Plugin): PluginAnalysis {
        val artifactId = plugin.artifactId ?: ""
        val evidence = mutableListOf<String>()
        
        // Categorize plugin types
        val pluginCategory = when {
            artifactId.contains("compiler") -> {
                evidence.add("Compiler plugin - typically cacheable")
                PluginCategory.COMPILER
            }
            artifactId.contains("surefire") || artifactId.contains("failsafe") -> {
                evidence.add("Test plugin - typically cacheable")
                PluginCategory.TESTING
            }
            artifactId.contains("install") || artifactId.contains("deploy") -> {
                evidence.add("Install/Deploy plugin - not cacheable")
                PluginCategory.DEPLOYMENT
            }
            artifactId.contains("clean") -> {
                evidence.add("Clean plugin - not cacheable")
                PluginCategory.CLEANUP
            }
            artifactId.contains("exec") -> {
                evidence.add("Execution plugin - potentially not cacheable")
                PluginCategory.EXECUTION
            }
            else -> {
                evidence.add("Unknown plugin category")
                PluginCategory.UNKNOWN
            }
        }
        
        return PluginAnalysis(
            category = pluginCategory,
            evidence = evidence
        )
    }
    
    private fun combineAnalyses(goal: String, paramAnalysis: ParameterAnalysis, pluginAnalysis: PluginAnalysis): MojoAnalysis {
        val evidence = mutableListOf<String>()
        evidence.addAll(paramAnalysis.evidence)
        evidence.addAll(pluginAnalysis.evidence)
        
        // Make definitive cacheability decisions based on analysis
        val (cacheable, reason) = when {
            // Not cacheable - modifies external state
            pluginAnalysis.category == PluginCategory.DEPLOYMENT -> {
                Pair(false, "Deployment plugin modifies external repositories")
            }
            pluginAnalysis.category == PluginCategory.CLEANUP -> {
                Pair(false, "Cleanup plugin performs destructive operations")
            }
            paramAnalysis.hasNetworkParams -> {
                Pair(false, "Has network parameters - modifies external state")
            }
            paramAnalysis.hasFileSystemWrite -> {
                Pair(false, "Has destructive file system operations")
            }
            
            // Cacheable - deterministic with local inputs/outputs
            pluginAnalysis.category == PluginCategory.COMPILER -> {
                Pair(true, "Compiler plugin produces deterministic outputs")
            }
            pluginAnalysis.category == PluginCategory.TESTING -> {
                Pair(true, "Test plugin with deterministic behavior")
            }
            paramAnalysis.hasInputs && paramAnalysis.hasOutputs -> {
                Pair(true, "Has clear input/output patterns")
            }
            
            // Default to cacheable - most Maven plugins are deterministic build tools
            else -> {
                Pair(true, "Standard Maven plugin - deterministic by default")
            }
        }
        
        return MojoAnalysis(
            goal = goal,
            cacheable = cacheable,
            reason = reason,
            evidence = evidence
        )
    }
    
}

// Data classes for analysis results
data class CacheabilityResult(
    val cacheable: Boolean,
    val reason: String,
    val mojoAnalyses: List<MojoAnalysis> = emptyList()
)

data class MojoAnalysis(
    val goal: String,
    val cacheable: Boolean,
    val reason: String,
    val evidence: List<String>
)

data class ParameterAnalysis(
    val hasInputs: Boolean,
    val hasOutputs: Boolean,
    val hasNetworkParams: Boolean,
    val hasFileSystemWrite: Boolean,
    val evidence: List<String>
)

data class PluginAnalysis(
    val category: PluginCategory,
    val evidence: List<String>
)

enum class PluginCategory {
    COMPILER, TESTING, DEPLOYMENT, CLEANUP, EXECUTION, UNKNOWN
}