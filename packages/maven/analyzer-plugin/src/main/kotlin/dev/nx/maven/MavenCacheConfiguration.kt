package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log

/**
 * Handles Maven phase caching configuration using a data-driven approach
 */
class MavenCacheConfiguration(
    private val objectMapper: ObjectMapper,
    private val log: Log
) {
    private val cacheConfig: JsonNode = loadCacheConfiguration()
    
    /**
     * Apply caching configuration to a Maven target based on the phase and project
     */
    fun applyCachingToTarget(target: ObjectNode, phase: String, mavenProject: MavenProject) {
        try {
            val cacheablePhases = cacheConfig.get("cacheablePhases")
            val nonCacheablePhases = cacheConfig.get("nonCacheablePhases")
            
            when {
                cacheablePhases?.has(phase) == true -> {
                    applyCacheableConfiguration(target, phase, mavenProject, cacheablePhases.get(phase))
                }
                nonCacheablePhases?.has(phase) == true -> {
                    applyNonCacheableConfiguration(target, nonCacheablePhases.get(phase))
                }
                else -> {
                    // Default: no caching for unknown phases
                    log.debug("No caching configuration found for phase: $phase")
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to apply caching configuration for phase $phase", e)
        }
    }
    
    private fun applyCacheableConfiguration(
        target: ObjectNode, 
        phase: String, 
        mavenProject: MavenProject, 
        phaseConfig: JsonNode
    ) {
        // Set cache and parallelism flags
        target.put("cache", phaseConfig.get("cache")?.asBoolean() ?: true)
        target.put("parallelism", phaseConfig.get("parallelism")?.asBoolean() ?: true)
        
        // Apply inputs configuration
        phaseConfig.get("inputs")?.let { inputsConfig ->
            val inputs = objectMapper.createArrayNode()
            if (inputsConfig.isArray) {
                inputsConfig.forEach { input ->
                    inputs.add(input.asText())
                }
            }
            target.put("inputs", inputs)
        }
        
        // Apply outputs configuration (handle packaging-specific outputs)
        phaseConfig.get("outputs")?.let { outputsConfig ->
            val outputs = objectMapper.createArrayNode()
            
            when {
                outputsConfig.isArray -> {
                    // Simple array of output patterns
                    outputsConfig.forEach { output ->
                        outputs.add(output.asText())
                    }
                }
                outputsConfig.isObject -> {
                    // Packaging-specific outputs
                    val packaging = mavenProject.packaging.lowercase()
                    val packagingOutputs = outputsConfig.get(packaging) ?: outputsConfig.get("default")
                    
                    packagingOutputs?.forEach { output ->
                        outputs.add(output.asText())
                    }
                }
            }
            
            if (outputs.size() > 0) {
                target.put("outputs", outputs)
            }
        }
        
        log.debug("Applied caching configuration for phase: $phase (cache=true)")
    }
    
    private fun applyNonCacheableConfiguration(target: ObjectNode, phaseConfig: JsonNode) {
        target.put("cache", false)
        
        // Apply parallelism if specified
        phaseConfig.get("parallelism")?.let { parallelism ->
            target.put("parallelism", parallelism.asBoolean())
        }
        
        val reason = phaseConfig.get("reason")?.asText() ?: "Not cacheable"
        log.debug("Applied non-cacheable configuration: $reason")
    }
    
    /**
     * Get the priority level of a phase (high, medium, low)
     */
    fun getPhasePriority(phase: String): String {
        val priorities = cacheConfig.get("phasePriority") ?: return "unknown"
        
        for (priority in listOf("high", "medium", "low")) {
            val phases = priorities.get(priority)
            if (phases?.isArray == true) {
                for (priorityPhase in phases) {
                    if (priorityPhase.asText() == phase) {
                        return priority
                    }
                }
            }
        }
        return "unknown"
    }
    
    /**
     * Check if a phase is cacheable according to configuration
     */
    fun isCacheable(phase: String): Boolean {
        val cacheablePhases = cacheConfig.get("cacheablePhases")
        return cacheablePhases?.has(phase) == true
    }
    
    /**
     * Get all configured cacheable phases
     */
    fun getCacheablePhases(): List<String> {
        val cacheablePhases = cacheConfig.get("cacheablePhases") ?: return emptyList()
        return cacheablePhases.fieldNames().asSequence().toList()
    }
    
    private fun loadCacheConfiguration(): JsonNode {
        return try {
            val resourceStream = this::class.java.getResourceAsStream("/maven-phase-cache-config.json")
            if (resourceStream != null) {
                objectMapper.readTree(resourceStream)
            } else {
                log.warn("Cache configuration file not found, using empty configuration")
                objectMapper.createObjectNode()
            }
        } catch (e: Exception) {
            log.error("Failed to load cache configuration", e)
            objectMapper.createObjectNode()
        }
    }
}