package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.model.Plugin
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.lifecycle.MavenExecutionPlan
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log

/**
 * Collects lifecycle and plugin information directly from Maven APIs
 */
class MavenLifecycleAnalyzer(
    private val lifecycles: DefaultLifecycles,
    private val sharedInputOutputAnalyzer: MavenInputOutputAnalyzer,
    private val lifecycleExecutor: LifecycleExecutor,
    private val session: MavenSession,
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
            println("Lifecycle: $lifecycle")
            lifecycle.phases.forEach { phase ->
                println("  Phase: $phase")
                result.add(phase)
            }
        }
        return result
    }

    fun generateGoalTargets(project: MavenProject, mavenCommand: String): Pair<Map<String, ObjectNode>, Map<String, List<String>>> {
        // Extract discovered plugin goals
        val plugins = getPlugins(project)
        val targets = mutableMapOf<String, ObjectNode>()
        val targetGroups = mutableMapOf<String, List<String>>()

        plugins.forEach { plugin ->
//            log.info("Discovered plugin: ${plugin.key} with goals: ${plugin.value.joinToString(", ")}")
            val goals = getGoals(plugin)
            val targetGroup = mutableListOf<String>()
            goals.forEach { goal ->
                targetGroup.add(goal)

                val (targetName, targetNode) = createGoalTarget(mavenCommand, project, plugin, goal)
                targets[targetName] = targetNode
            }
            targetGroups[cleanPluginName(plugin)] = targetGroup
        }

        return Pair(targets, targetGroups)

//        if (discoveredGoals.isNotEmpty()) {
//            val goalsByPlugin = mutableMapOf<String, MutableList<String>>()
//
//            discoveredGoals.forEach { pluginGoal ->
//                val parts = pluginGoal.split(":")
//                if (parts.size == 2) {
//                    val originalPluginName = parts[0]
//                    val goalName = parts[1]
//                    val cleanPluginName = cleanPluginName(originalPluginName)
//                    goalsByPlugin.getOrPut(cleanPluginName) { mutableListOf() }.add("$originalPluginName:$goalName")
//                }
//            }
//
//            goalsByPlugin.forEach { (cleanPluginName, pluginGoals) ->
//                val pluginTargetGroup = objectMapper.createArrayNode()
//
//                pluginGoals.forEach { pluginGoal ->
//                    val parts = pluginGoal.split(":")
//                    val originalPluginName = parts[0]
//                    val goalName = parts[1]
//
//                    val target = objectMapper.createObjectNode()
//                    target.put("executor", "nx:run-commands")
//
//                    val options = objectMapper.createObjectNode()
//                    options.put(
//                        "command",
//                        "$mavenCommand $cleanPluginName:$goalName -am -pl ${project.groupId}:${project.artifactId}"
//                    )
//                    options.put("cwd", "{workspaceRoot}")
//                    target.put("options", options)
//
//                    target.put("cache", false)
//                    target.put("parallelism", false)
//
//                    val targetName = "$cleanPluginName:$goalName"
//                    targets.put(targetName, target)
//                    pluginTargetGroup.add(targetName)
//                }
//
//                targetGroups.put(cleanPluginName, pluginTargetGroup)
//            }
//        }
    }

    internal fun createGoalTarget(mavenCommand: String, project: MavenProject, plugin: Plugin, goalName: String): Pair< String, ObjectNode> {
        val target = objectMapper.createObjectNode()

        val cleanPluginName = cleanPluginName(plugin)
        target.put("executor", "nx:run-commands")

        val options = objectMapper.createObjectNode()
        options.put(
            "command",
            "$mavenCommand $cleanPluginName:$goalName -am -pl ${project.groupId}:${project.artifactId}"
        )
        target.put("options", options)

        target.put("cache", false)
        target.put("parallelism", false)

        val targetName = "$cleanPluginName:$goalName"

        return Pair(targetName, target);
    }

    internal fun getGoals(plugin: Plugin): Set<String> {
        val result = mutableSetOf<String>()

        plugin.executions.forEach { execution ->
            execution.goals.forEach { goal ->
                result.add("${plugin.groupId}:${plugin.artifactId}:$goal")
            }
        }
        return result
    }

    internal fun getPlugins(mavenProject: MavenProject): List<org.apache.maven.model.Plugin> {
        return mavenProject.build.plugins
    }

    fun extractLifecycleData(mavenProject: MavenProject): ObjectNode {
        val result = objectMapper.createObjectNode()

        lifecycles.lifecyclePhaseList


        val executionPlans = getExecutionPlans()

//        executionPlans.forEach { plan ->
//            plan.mojoExecutions?.forEach { execution ->
//                execution.lifecyclePhase
//            }
//        }
//
//        try {
//            result.put("projectPlugins", getProjectPlugins(mavenProject))
//            result.put("projectInfo", getProjectInfo(mavenProject))
//
//        } catch (e: Exception) {
//            log.error("Failed to extract lifecycle data for project: ${mavenProject.artifactId}", e)
//            throw e
//        }

        return result
    }

    /**
     * Get execution plans for Maven lifecycles
     */
    private fun getExecutionPlans(): Set<MavenExecutionPlan> {
        val plans = mutableSetOf<MavenExecutionPlan>()

        lifecycles.lifeCycles.forEach { lifecycle ->
            println("Lifecycle: $lifecycle")
            lifecycle.phases.forEach { phase ->
                println("  Phase: $phase")
//                val plan = lifecycleExecutor.calculateExecutionPlan(session, lifecycle, phase)
//                plans.add(phase)
            }
        }

        DefaultLifecycles.STANDARD_LIFECYCLES.forEach { lifecycleName ->
            val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, lifecycleName)

            plans.add(executionPlan)
        }

        return plans
    }

    /**
     * Convert Maven execution plan to JSON
     */
    private fun convertExecutionPlan(plan: MavenExecutionPlan?): ObjectNode {
        val planNode = objectMapper.createObjectNode()

        if (plan == null) {
            planNode.put("executions", objectMapper.createArrayNode())
            return planNode
        }

        val executions = objectMapper.createArrayNode()

        plan.mojoExecutions?.forEach { execution ->
            val execNode = objectMapper.createObjectNode()
            execNode.put("plugin", "${execution.plugin.groupId}:${execution.plugin.artifactId}")
            execNode.put("version", execution.plugin.version)
            execNode.put("goal", execution.goal)
            execNode.put("phase", execution.lifecyclePhase)
            execNode.put("executionId", execution.executionId)
            executions.add(execNode)
        }

        planNode.put("executions", executions)
        return planNode
    }

    /**
     * Get plugins configured in the project
     */
    private fun getProjectPlugins(mavenProject: MavenProject): ObjectNode {
        val pluginsNode = objectMapper.createObjectNode()

        // Build plugins
        val buildPlugins = objectMapper.createArrayNode()
        mavenProject.build?.plugins?.forEach { plugin ->
            buildPlugins.add(convertPlugin(plugin))
        }
        pluginsNode.put("build", buildPlugins)

        // Plugin management
        val managedPlugins = objectMapper.createArrayNode()
        mavenProject.build?.pluginManagement?.plugins?.forEach { plugin ->
            managedPlugins.add(convertPlugin(plugin))
        }
        pluginsNode.put("management", managedPlugins)

        return pluginsNode
    }

    /**
     * Convert Maven plugin to JSON
     */
    private fun convertPlugin(plugin: Plugin): ObjectNode {
        val pluginNode = objectMapper.createObjectNode()
        pluginNode.put("groupId", plugin.groupId)
        pluginNode.put("artifactId", plugin.artifactId)
        pluginNode.put("version", plugin.version)

        // Executions
        val executions = objectMapper.createArrayNode()
        plugin.executions?.forEach { execution ->
            val execNode = objectMapper.createObjectNode()
            execNode.put("id", execution.id)
            execNode.put("phase", execution.phase)

            val goals = objectMapper.createArrayNode()
            execution.goals?.forEach { goal -> goals.add(goal) }
            execNode.put("goals", goals)

            executions.add(execNode)
        }
        pluginNode.put("executions", executions)

        return pluginNode
    }

    /**
     * Get basic project information
     */
    private fun getProjectInfo(mavenProject: MavenProject): ObjectNode {
        val projectNode = objectMapper.createObjectNode()
        projectNode.put("groupId", mavenProject.groupId)
        projectNode.put("artifactId", mavenProject.artifactId)
        projectNode.put("version", mavenProject.version)
        projectNode.put("packaging", mavenProject.packaging)
        projectNode.put("name", mavenProject.name)

        return projectNode
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
