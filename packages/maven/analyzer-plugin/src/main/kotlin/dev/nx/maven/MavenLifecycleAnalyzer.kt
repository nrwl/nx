package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import dev.nx.maven.plugin.PluginExecutionFinder
import org.apache.maven.model.Plugin
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log

/**
 * Collects lifecycle and plugin information directly from Maven APIs
 */
class MavenLifecycleAnalyzer(
    private val lifecycles: DefaultLifecycles,
    private val sharedInputOutputAnalyzer: MavenInputOutputAnalyzer,
    private val pluginExecutionFinder: PluginExecutionFinder,
    private val objectMapper: ObjectMapper,
    private val log: Log,
) {
    fun generatePhaseTargets(
        project: MavenProject,
        mavenCommand: String,
    ): Map<String, ObjectNode> {
        val targets = mutableMapOf<String, ObjectNode>()
        // Extract discovered phases from lifecycle analysis
        val phasesToAnalyze = getPhases()

        log.info("Analyzing ${phasesToAnalyze.size} phases for ${project.artifactId}: ${phasesToAnalyze.joinToString(", ")}")

        // Generate targets from phase analysis
        phasesToAnalyze.forEach { phase ->
            try {
                val analysis = sharedInputOutputAnalyzer.analyzeCacheability(phase, project)
                log.warn("Phase '$phase' analysis result: cacheable=${analysis.cacheable}, reason='${analysis.reason}'")

                val target = objectMapper.createObjectNode()
                target.put("executor", "nx:run-commands")

                val options = objectMapper.createObjectNode()
                options.put("command", "$mavenCommand $phase -am -pl ${project.groupId}:${project.artifactId}")
                options.put("cwd", "{workspaceRoot}")
                target.put("options", options)

                // Copy caching info from analysis
                if (analysis.cacheable) {
                    target.put("cache", true)
                    target.put("inputs", analysis.inputs)
                    target.put("outputs", analysis.outputs)
                } else {
                    target.put("cache", false)
                }

                target.put("parallelism", true)
                targets[phase] = target

            } catch (e: Exception) {
                log.debug("Failed to analyze phase '$phase' for project ${project.artifactId}: ${e.message}")
            }
        }
        return targets
    }

    fun getPhases(): Set<String> {
        val result = mutableSetOf<String>()
        lifecycles.lifeCycles.forEach { lifecycle ->
            lifecycle.phases.forEach { phase ->
                result.add(phase)
            }
        }
        return result
    }

    fun generateGoalTargets(project: MavenProject, mavenCommand: String): Pair<Map<String, ObjectNode>, Map<String, List<String>>> {
        // Extract discovered plugin goals
        val plugins = pluginExecutionFinder.getExecutablePlugins(project)
        val targets = mutableMapOf<String, ObjectNode>()
        val targetGroups = mutableMapOf<String, List<String>>()

        plugins.forEach { plugin: Plugin ->
            val goals = getGoals(plugin)
            val targetGroup = mutableListOf<String>()
            val cleanPluginName = cleanPluginName(plugin)
            goals.forEach { goal ->
                val (targetName, targetNode) = createGoalTarget(mavenCommand, project, cleanPluginName, goal)
                targetGroup.add(targetName)
                targets[targetName] = targetNode
            }
            targetGroups[cleanPluginName] = targetGroup
        }

        return Pair(targets, targetGroups)
    }

    internal fun createGoalTarget(mavenCommand: String, project: MavenProject, cleanPluginName: String, goalName: String): Pair< String, ObjectNode> {
        val target = objectMapper.createObjectNode()

        target.put("executor", "nx:run-commands")

        val options = objectMapper.createObjectNode()
        options.put(
            "command",
            "$mavenCommand $cleanPluginName:$goalName -am -pl ${project.groupId}:${project.artifactId}"
        )
        target.put("options", options)

        target.put("cache", false)
        target.put("parallelism", false)

        return Pair("$cleanPluginName:$goalName", target);
    }

    internal fun getGoals(plugin: Plugin): Set<String> {
        val result = mutableSetOf<String>()

        plugin.executions.forEach { execution ->
            execution.goals.forEach { goal ->
                result.add(goal)
            }
        }
        return result
    }


    /**
     * Clean plugin name for better target naming
     */
    private fun cleanPluginName(plugin: Plugin): String {
        val fullPluginName = "${plugin.groupId}.${plugin.artifactId}"
        return fullPluginName
            .replace("org.apache.maven.plugins.", "")
            .replace("maven-", "")
            .replace("-plugin", "")
    }
}
