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
            
            // Fallback to our own analysis if extension not available
            analyzeWithoutExtension(execution, project)
            
        } catch (e: Exception) {
            log.debug("Failed to check Build Cache Extension cacheability", e)
            // Fallback analysis
            analyzeWithoutExtension(execution, project)
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
    
    private fun analyzeWithoutExtension(execution: MojoExecution, project: MavenProject): CacheabilityDecision {
        val goal = "${execution.plugin.artifactId}:${execution.goal}"
        
        // Simple fallback analysis based on known patterns
        val cacheable = when {
            goal.contains("install") || goal.contains("deploy") -> false
            goal.contains("clean") -> false
            goal.contains("compile") || goal.contains("test") || goal.contains("package") -> true
            else -> true // Default to cacheable
        }
        
        val reason = when {
            goal.contains("install") || goal.contains("deploy") -> "Modifies external repositories"
            goal.contains("clean") -> "Destructive file operations"
            goal.contains("compile") || goal.contains("test") || goal.contains("package") -> "Standard build goal"
            else -> "No known side effects"
        }
        
        return CacheabilityDecision(
            cacheable = cacheable,
            reason = reason,
            source = "Fallback analysis"
        )
    }
    
    /**
     * Apply the cacheability decision to an Nx target configuration
     */
    fun applyCacheabilityToTarget(target: ObjectNode, decision: CacheabilityDecision) {
        if (decision.cacheable) {
            target.put("cache", true)
            
            // Add basic inputs for cacheable targets
            val inputs = target.putArray("inputs")
            inputs.add("{projectRoot}/src/**/*")
            inputs.add("{projectRoot}/pom.xml")
            
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
    }
}

/**
 * Result of cacheability analysis
 */
data class CacheabilityDecision(
    val cacheable: Boolean,
    val reason: String,
    val source: String // "Build Cache Extension" or "Fallback analysis"
)