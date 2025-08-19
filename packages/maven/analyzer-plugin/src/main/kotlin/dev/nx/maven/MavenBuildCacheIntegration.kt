package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MojoExecution
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Attempts to integrate with Maven's Build Cache Extension to determine cacheability
 */
class MavenBuildCacheIntegration(
    private val session: MavenSession,
    private val objectMapper: ObjectMapper,
    private val log: Log
) {
    
    /**
     * Try to determine if a mojo execution is cacheable according to Maven's Build Cache Extension
     */
    fun isMojoExecutionCacheable(execution: MojoExecution, project: MavenProject): CacheabilityDecision {
        return try {
            // Attempt to access Maven Build Cache Extension components
            val cacheabilityFromExtension = checkBuildCacheExtension(execution, project)
            if (cacheabilityFromExtension != null) {
                return cacheabilityFromExtension
            }
            
            // Return null if extension not available - only use Maven's logic
            CacheabilityDecision(
                cacheable = false,
                reason = "Maven Build Cache Extension not available",
                source = "Extension unavailable"
            )
            
        } catch (e: Exception) {
            log.debug("Failed to check Build Cache Extension cacheability", e)
            // Only use Maven's logic - no fallback
            CacheabilityDecision(
                cacheable = false,
                reason = "Failed to access Maven Build Cache Extension: ${e.message}",
                source = "Extension error"
            )
        }
    }
    
    private fun checkBuildCacheExtension(execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        // Try to access Maven Build Cache Extension APIs
        
        try {
            // Check if Build Cache Extension is active
            val isBuildCacheActive = checkIfBuildCacheExtensionActive()
            if (!isBuildCacheActive) {
                log.debug("Maven Build Cache Extension not detected/active")
                return null
            }
            
            // Try to access the extension's cacheability logic
            return accessExtensionCacheability(execution, project)
            
        } catch (e: ClassNotFoundException) {
            log.debug("Maven Build Cache Extension classes not found", e)
            return null
        } catch (e: Exception) {
            log.debug("Error accessing Build Cache Extension", e)
            return null
        }
    }
    
    private fun checkIfBuildCacheExtensionActive(): Boolean {
        return try {
            // Try to load a class from the Build Cache Extension
            Class.forName("org.apache.maven.buildcache.CacheController")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }
    
    private fun accessExtensionCacheability(execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        // Access the actual Build Cache Extension APIs
        
        try {
            // Try to use the Build Cache Extension components
            val cacheController = getCacheController()
            if (cacheController != null) {
                return checkCacheabilityWithController(cacheController, execution, project)
            }
            
            // Alternative: Check Build Cache Configuration
            val cacheConfig = getCacheConfig()
            if (cacheConfig != null) {
                return checkCacheabilityWithConfig(cacheConfig, execution, project)
            }
            
            log.debug("Could not access Build Cache Extension components")
            return null
            
        } catch (e: Exception) {
            log.debug("Failed to access extension cacheability", e)
            return null
        }
    }
    
    private fun getCacheController(): Any? {
        return try {
            // Access CacheController through Plexus container
            val container = session.container
            val controllerClass = Class.forName("org.apache.maven.buildcache.CacheController")
            
            // Look up the component by class
            container.lookup(controllerClass)
        } catch (e: Exception) {
            log.debug("Failed to lookup CacheController from container", e)
            null
        }
    }
    
    private fun getCacheConfig(): Any? {
        return try {
            // Look for CacheConfig implementation
            val container = session.container
            val configClass = Class.forName("org.apache.maven.buildcache.xml.CacheConfigImpl")
            
            container.lookup(configClass)
        } catch (e: Exception) {
            log.debug("Failed to lookup CacheConfig from container", e)
            null
        }
    }
    
    private fun checkCacheabilityWithController(controller: Any, execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        return try {
            // Use reflection to call the cache controller methods
            val controllerClass = controller.javaClass
            
            // Look for a method that can determine if a mojo execution is cacheable
            // Based on Maven Build Cache Extension source, this might be something like:
            // - isCacheable(MojoExecution)
            // - shouldCache(MojoExecution) 
            // - getCacheability(MojoExecution)
            
            val methods = controllerClass.methods
            log.debug("Available CacheController methods: ${methods.map { it.name }.joinToString()}")
            
            // Look for relevant methods
            val cacheableMethod = methods.find { method ->
                method.name.contains("cache", ignoreCase = true) && 
                method.parameterCount == 1 &&
                method.parameterTypes[0].isAssignableFrom(execution.javaClass)
            }
            
            if (cacheableMethod != null) {
                val result = cacheableMethod.invoke(controller, execution)
                log.debug("CacheController method ${cacheableMethod.name} returned: $result")
                
                return CacheabilityDecision(
                    cacheable = result == true || (result is String && result != "skip"),
                    reason = "Maven Build Cache Extension decision",
                    source = "Build Cache Extension"
                )
            }
            
            null
        } catch (e: Exception) {
            log.debug("Failed to check cacheability with controller", e)
            null
        }
    }
    
    private fun checkCacheabilityWithConfig(config: Any, execution: MojoExecution, project: MavenProject): CacheabilityDecision? {
        return try {
            val configClass = config.javaClass
            val goal = "${execution.plugin.artifactId}:${execution.goal}"
            
            // Look for configuration methods that determine cacheability
            val methods = configClass.methods
            log.debug("Available CacheConfig methods: ${methods.map { it.name }.joinToString()}")
            
            // Look for methods that might indicate exclusion patterns
            // Common patterns: getIgnoredPatterns(), getRunAlways(), isIgnored(), etc.
            val ignoredMethod = methods.find { it.name.contains("ignore", ignoreCase = true) }
            val runAlwaysMethod = methods.find { it.name.contains("runAlways", ignoreCase = true) }
            
            var cacheable = true
            var reason = "Default cacheable"
            
            // Check if this goal should always run (never cached)
            if (runAlwaysMethod != null) {
                try {
                    val runAlwaysResult = runAlwaysMethod.invoke(config)
                    if (runAlwaysResult is Collection<*>) {
                        val patterns = runAlwaysResult.filterIsInstance<String>()
                        if (patterns.any { pattern -> goal.matches(Regex(pattern.replace("*", ".*"))) }) {
                            cacheable = false
                            reason = "Matched runAlways pattern"
                        }
                    }
                } catch (e: Exception) {
                    log.debug("Error checking runAlways patterns", e)
                }
            }
            
            // Check if this goal is explicitly ignored
            if (ignoredMethod != null && cacheable) {
                try {
                    val ignoredResult = ignoredMethod.invoke(config)
                    if (ignoredResult is Collection<*>) {
                        val patterns = ignoredResult.filterIsInstance<String>()
                        if (patterns.any { pattern -> goal.matches(Regex(pattern.replace("*", ".*"))) }) {
                            cacheable = false
                            reason = "Matched ignore pattern"
                        }
                    }
                } catch (e: Exception) {
                    log.debug("Error checking ignore patterns", e)
                }
            }
            
            return CacheabilityDecision(
                cacheable = cacheable,
                reason = reason,
                source = "Build Cache Extension Config"
            )
            
        } catch (e: Exception) {
            log.debug("Failed to check cacheability with config", e)
            null
        }
    }
    
    
    /**
     * Apply the cacheability decision to an Nx target configuration
     */
    fun applyCacheabilityToTarget(target: ObjectNode, decision: CacheabilityDecision) {
        if (decision.cacheable) {
            target.put("cache", true)
            
            // Use Maven-derived inputs if available, otherwise no inputs
            if (decision.inputs.isNotEmpty()) {
                val inputs = target.putArray("inputs")
                decision.inputs.forEach { input ->
                    inputs.add(input)
                }
            }
            
            // Add basic outputs for cacheable targets  
            val outputs = target.putArray("outputs")
            outputs.add("{projectRoot}/target")
            
        } else {
            target.put("cache", false)
        }
        
        // Add metadata about the decision
        val metadata = target.putObject("metadata")
        metadata.put("cacheDecisionReason", decision.reason)
        metadata.put("cacheDecisionSource", decision.source)
        if (decision.inputs.isNotEmpty()) {
            metadata.put("mavenInputsCount", decision.inputs.size)
        }
    }
    
    /**
     * Extract Maven's input analysis for a mojo execution to use as Nx target inputs
     */
    fun extractMavenInputs(execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val inputs = mutableListOf<String>()
            
            // Try to access Maven Build Cache Extension input calculator
            val inputCalculator = getProjectInputCalculator()
            if (inputCalculator != null) {
                val mavenInputs = calculateInputsWithExtension(inputCalculator, execution, project)
                inputs.addAll(mavenInputs)
                log.debug("Extracted ${mavenInputs.size} inputs from Maven Build Cache Extension")
            } else {
                // Only use Maven's logic - no fallback
                log.debug("Maven Build Cache Extension input calculator not available")
            }
            
            inputs
        } catch (e: Exception) {
            log.debug("Failed to extract Maven inputs", e)
            emptyList() // Only use Maven's logic - no fallback
        }
    }
    
    private fun getProjectInputCalculator(): Any? {
        return try {
            val container = session.container
            val calculatorClass = Class.forName("org.apache.maven.buildcache.DefaultProjectInputCalculator")
            container.lookup(calculatorClass)
        } catch (e: Exception) {
            log.debug("Failed to lookup ProjectInputCalculator", e)
            null
        }
    }
    
    private fun calculateInputsWithExtension(calculator: Any, execution: MojoExecution, project: MavenProject): List<String> {
        return try {
            val calculatorClass = calculator.javaClass
            val methods = calculatorClass.methods
            
            // Look for methods that calculate inputs
            val calculateMethod = methods.find { method ->
                method.name.contains("calculate", ignoreCase = true) || 
                method.name.contains("input", ignoreCase = true)
            }
            
            if (calculateMethod != null) {
                log.debug("Found input calculation method: ${calculateMethod.name}")
                
                // Try to invoke the method with different parameter combinations
                val result = when {
                    calculateMethod.parameterCount == 2 -> calculateMethod.invoke(calculator, execution, project)
                    calculateMethod.parameterCount == 1 -> calculateMethod.invoke(calculator, project)
                    else -> calculateMethod.invoke(calculator)
                }
                
                return extractInputPathsFromResult(result, project)
            }
            
            emptyList()
        } catch (e: Exception) {
            log.debug("Failed to calculate inputs with extension", e)
            emptyList()
        }
    }
    
    private fun extractInputPathsFromResult(result: Any?, project: MavenProject): List<String> {
        val inputs = mutableListOf<String>()
        
        when (result) {
            is Collection<*> -> {
                result.forEach { item ->
                    extractPathFromInputItem(item, project)?.let { inputs.add(it) }
                }
            }
            is Array<*> -> {
                result.forEach { item ->
                    extractPathFromInputItem(item, project)?.let { inputs.add(it) }
                }
            }
            else -> {
                extractPathFromInputItem(result, project)?.let { inputs.add(it) }
            }
        }
        
        return inputs
    }
    
    private fun extractPathFromInputItem(item: Any?, project: MavenProject): String? {
        if (item == null) return null
        
        return try {
            val itemClass = item.javaClass
            
            // Look for path-related methods or fields
            val pathMethods = itemClass.methods.filter { method ->
                method.name.contains("path", ignoreCase = true) ||
                method.name.contains("file", ignoreCase = true) ||
                method.name == "toString"
            }
            
            for (method in pathMethods) {
                if (method.parameterCount == 0) {
                    val result = method.invoke(item)
                    if (result is String && result.isNotBlank()) {
                        return convertToNxInputPattern(result, project)
                    }
                }
            }
            
            // Fallback to toString
            item.toString().takeIf { it.isNotBlank() }?.let { convertToNxInputPattern(it, project) }
        } catch (e: Exception) {
            log.debug("Failed to extract path from input item", e)
            null
        }
    }
    
    private fun convertToNxInputPattern(mavenPath: String, project: MavenProject): String {
        val projectRoot = project.basedir.absolutePath
        
        return when {
            mavenPath.startsWith(projectRoot as CharSequence) -> {
                // Convert absolute path to relative Nx pattern
                val relativePath = mavenPath.removePrefix(projectRoot).removePrefix("/")
                "{projectRoot}/$relativePath"
            }
            mavenPath.startsWith("src/") -> "{projectRoot}/$mavenPath"
            mavenPath == "pom.xml" -> "{projectRoot}/pom.xml"
            mavenPath.startsWith("/") -> mavenPath // Keep absolute paths as-is
            else -> "{projectRoot}/$mavenPath" // Default to project-relative
        }
    }
}

/**
 * Result of cacheability analysis
 */
data class CacheabilityDecision(
    val cacheable: Boolean,
    val reason: String,
    val source: String, // "Build Cache Extension" or "Fallback analysis"
    val inputs: List<String> = emptyList() // Maven-derived input patterns
)