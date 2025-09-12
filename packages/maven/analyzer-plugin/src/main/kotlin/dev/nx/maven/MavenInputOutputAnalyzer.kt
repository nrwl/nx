package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import dev.nx.maven.plugin.PluginBasedAnalyzer

/**
 * Maven input/output analyzer using plugin parameter analysis
 * Examines actual plugin parameters to determine what files each phase reads and writes
 */
class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    private val workspaceRoot: String,
    private val pluginAnalyzer: PluginBasedAnalyzer
) {
    private val log: Logger = LoggerFactory.getLogger(MavenInputOutputAnalyzer::class.java)

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
        log.warn("*** ANALYZING CACHEABILITY FOR PHASE '$phase' ***")
        if (phase == "verify") {
            log.warn("*** VERIFY PHASE ANALYSIS STARTING ***")
        }

        // Create project-specific path resolver to ensure {projectRoot} refers to project directory
        val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath)

        val inputsSet = linkedSetOf<String>()
        val outputsSet = linkedSetOf<String>()

        // Let plugin parameter analysis determine ALL inputs - no hardcoded assumptions

        // Analyze the phase using plugin parameter examination
        pluginAnalyzer.analyzePhaseInputsOutputs(phase, project, inputsSet, outputsSet, pathResolver)

        // Convert sets to ArrayNodes for final return
        val inputs = objectMapper.createArrayNode()
        val outputs = objectMapper.createArrayNode()

        // Add dependentTasksOutputFiles to automatically include outputs from dependsOn tasks as inputs
        val dependentTasksOutputFiles = objectMapper.createObjectNode()
        dependentTasksOutputFiles.put("dependentTasksOutputFiles", "**/*")
        dependentTasksOutputFiles.put("transitive", true)
        inputs.add(dependentTasksOutputFiles)

        // Add all collected inputs and outputs from sets
        inputsSet.forEach { inputs.add(it) }
        outputsSet.forEach { outputs.add(it) }

        log.info("Analyzed phase '$phase': ${inputs.size()} inputs (${inputsSet.size} unique paths), ${outputs.size()} outputs (${outputsSet.size} unique paths)")

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
