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
     * Analyze if a Maven phase is cacheable by examining the actual mojo executions
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
                reason = "Analysis failed: ${e.message}",
                confidence = Confidence.LOW
            )
        }
    }
    
    private fun analyzeMojoExecutions(executions: List<MojoExecution>, phase: String): CacheabilityResult {
        if (executions.isEmpty()) {
            return CacheabilityResult(
                cacheable = false,
                reason = "No mojo executions found for phase",
                confidence = Confidence.HIGH
            )
        }
        
        val mojoAnalyses = executions.map { execution ->
            analyzeSingleMojoExecution(execution)
        }
        
        // If any mojo is definitely not cacheable, the whole phase is not cacheable
        val nonCacheable = mojoAnalyses.find { !it.cacheable && it.confidence == Confidence.HIGH }
        if (nonCacheable != null) {
            return CacheabilityResult(
                cacheable = false,
                reason = "Contains non-cacheable mojo: ${nonCacheable.reason}",
                confidence = Confidence.HIGH,
                mojoAnalyses = mojoAnalyses
            )
        }
        
        // If all mojos are definitely cacheable, the phase is cacheable
        val allCacheable = mojoAnalyses.all { it.cacheable }
        if (allCacheable) {
            return CacheabilityResult(
                cacheable = true,
                reason = "All mojos appear cacheable",
                confidence = determineConfidence(mojoAnalyses),
                mojoAnalyses = mojoAnalyses
            )
        }
        
        // Mixed or uncertain results
        return CacheabilityResult(
            cacheable = false,
            reason = "Uncertain mojo cacheability - defaulting to safe (non-cacheable)",
            confidence = Confidence.MEDIUM,
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
        
        // Known non-cacheable goals
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
                confidence = Confidence.HIGH,
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
        
        // Determine cacheability based on combined analysis
        val (cacheable, reason, confidence) = when {
            // Definitely not cacheable
            pluginAnalysis.category == PluginCategory.DEPLOYMENT -> {
                Triple(false, "Deployment plugin modifies external repositories", Confidence.HIGH)
            }
            pluginAnalysis.category == PluginCategory.CLEANUP -> {
                Triple(false, "Cleanup plugin performs destructive operations", Confidence.HIGH)
            }
            paramAnalysis.hasNetworkParams -> {
                Triple(false, "Has network parameters - likely modifies external state", Confidence.HIGH)
            }
            paramAnalysis.hasFileSystemWrite -> {
                Triple(false, "Has file system write parameters", Confidence.HIGH)
            }
            
            // Likely cacheable
            pluginAnalysis.category == PluginCategory.COMPILER && paramAnalysis.hasInputs && paramAnalysis.hasOutputs -> {
                Triple(true, "Compiler plugin with clear inputs/outputs", Confidence.HIGH)
            }
            pluginAnalysis.category == PluginCategory.TESTING && paramAnalysis.hasInputs -> {
                Triple(true, "Test plugin with inputs - likely deterministic", Confidence.MEDIUM)
            }
            
            // Uncertain
            else -> {
                Triple(false, "Insufficient information to determine cacheability", Confidence.LOW)
            }
        }
        
        return MojoAnalysis(
            goal = goal,
            cacheable = cacheable,
            reason = reason,
            confidence = confidence,
            evidence = evidence
        )
    }
    
    private fun determineConfidence(analyses: List<MojoAnalysis>): Confidence {
        return when {
            analyses.all { it.confidence == Confidence.HIGH } -> Confidence.HIGH
            analyses.any { it.confidence == Confidence.HIGH } -> Confidence.MEDIUM
            else -> Confidence.LOW
        }
    }
}

// Data classes for analysis results
data class CacheabilityResult(
    val cacheable: Boolean,
    val reason: String,
    val confidence: Confidence,
    val mojoAnalyses: List<MojoAnalysis> = emptyList()
)

data class MojoAnalysis(
    val goal: String,
    val cacheable: Boolean,
    val reason: String,
    val confidence: Confidence,
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

enum class Confidence {
    HIGH, MEDIUM, LOW
}

enum class PluginCategory {
    COMPILER, TESTING, DEPLOYMENT, CLEANUP, EXECUTION, UNKNOWN
}