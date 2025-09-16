package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import dev.nx.maven.plugin.PluginExecutionFinder
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.model.Plugin
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Collects lifecycle and plugin information directly from Maven APIs
 */
class NxTargetFactory(
    private val lifecycles: DefaultLifecycles,
    private val pluginExecutionFinder: PluginExecutionFinder,
    private val objectMapper: ObjectMapper,
    private val testClassDiscovery: TestClassDiscovery,
    private val phaseAnalyzer: PhaseAnalyzer
) {
    private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)
    fun createNxTargets(
        mavenCommand: String,
        project: MavenProject
    ): Pair<ObjectNode, ObjectNode> {
        val nxTargets = objectMapper.createObjectNode()

        // Generate targets from discovered plugin goals
        val targetGroups = objectMapper.createObjectNode()

        val phaseTargets = generatePhaseTargets(project, mavenCommand)
        val mavenPhasesGroup = objectMapper.createArrayNode()
        phaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target)
            mavenPhasesGroup.add(phase)
        }
        targetGroups.put("maven-phases", mavenPhasesGroup)

        val (goalTargets, goalGroups) = generateGoalTargets(project, mavenCommand)

        goalTargets.forEach { (goal, target) ->
            nxTargets.set<ObjectNode>(goal, target)
        }
        goalGroups.forEach { (groupName, group) ->
            val groupArray = objectMapper.createArrayNode()
            group.forEach { goal -> groupArray.add(goal) }
            targetGroups.put(groupName, groupArray)
        }

        val (atomizedTestTargets, atomizedTestTargetGroups) = generateAtomizedTestTargets(project, mavenCommand)

        atomizedTestTargets.forEach { (goal, target) ->
            nxTargets.set<ObjectNode>(goal, target)
        }
        atomizedTestTargetGroups.forEach { (groupName, group) ->
            val groupArray = objectMapper.createArrayNode()
            group.forEach { goal -> groupArray.add(goal) }
            targetGroups.put(groupName, groupArray)
        }

        return Pair(nxTargets, targetGroups)
    }

    private fun generatePhaseTargets(
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
                val analysis = phaseAnalyzer.analyze(project, phase)


//                val analysis = sharedInputOutputAnalyzer.analyzeCacheability(phase, project)
//                log.warn("Phase '$phase' analysis result: cacheable=${analysis.cacheable}, reason='${analysis.reason}'")

                val target = objectMapper.createObjectNode()
                target.put("executor", "nx:run-commands")

                val options = objectMapper.createObjectNode()
                options.put("command", "$mavenCommand $phase -am -pl ${project.groupId}:${project.artifactId}")
                target.put("options", options)

                // Copy caching info from analysis
                if (analysis.isCacheable) {
                    target.put("cache", true)

                    // Convert inputs to JsonNode array
                    val inputsArray = objectMapper.createArrayNode()
                    analysis.inputs.forEach { input -> inputsArray.add(input) }
                    target.set<ArrayNode>("inputs", inputsArray)

                    // Convert outputs to JsonNode array
                    val outputsArray = objectMapper.createArrayNode()
                    analysis.outputs.forEach { output -> outputsArray.add(output) }
                    target.set<ArrayNode>("outputs", outputsArray)
                } else {
                    target.put("cache", false)
                }

                target.put("parallelism", analysis.isThreadSafe)
                targets[phase] = target

            } catch (e: Exception) {
                log.debug("Failed to analyze phase '$phase' for project ${project.artifactId}: ${e.message}")
            }
        }
        return targets
    }

    private fun generateGoalTargets(
        project: MavenProject,
        mavenCommand: String
    ): Pair<Map<String, ObjectNode>, Map<String, List<String>>> {
        val targets = mutableMapOf<String, ObjectNode>()
        val targetGroups = mutableMapOf<String, List<String>>()

        // Extract discovered plugin goals
        val plugins = pluginExecutionFinder.getExecutablePlugins(project)

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

    private fun generateAtomizedTestTargets(
        project: MavenProject,
        mavenCommand: String
    ): Pair<Map<String, ObjectNode>, Map<String, List<String>>> {
        val targets = mutableMapOf<String, ObjectNode>()
        val targetGroups = mutableMapOf<String, List<String>>()

        val testClasses = testClassDiscovery.discoverTestClasses(project)
        val testTargetNames = mutableListOf<String>()

        val verifyCiTarget = objectMapper.createObjectNode()
        verifyCiTarget.put("executor", "nx:noop")
        verifyCiTarget.put("cache", true)
        val dependsOn = objectMapper.createArrayNode()

        testClasses.forEach { testClass ->
            val targetName = "test--${testClass.packagePath}.${testClass.className}"

            testTargetNames.add(targetName)

            log.info("Generating target for test class: $targetName'")
            val target = objectMapper.createObjectNode()

            target.put("executor", "nx:run-commands")

            val options = objectMapper.createObjectNode()
            options.put(
                "command",
                "$mavenCommand test -am -pl ${project.groupId}:${project.artifactId} -Dtest=${testClass.packagePath}.${testClass.className}"
            )
            target.put("options", options)

            target.put("cache", false)
            target.put("parallelism", false)

            dependsOn.add(targetName)
            targets[targetName] = target
        }

        verifyCiTarget.put("dependsOn", dependsOn)
        targets["verify-ci"] = verifyCiTarget



        return Pair(targets, targetGroups)
    }

    private fun getPhases(): Set<String> {
        val result = mutableSetOf<String>()
        lifecycles.lifeCycles.forEach { lifecycle ->
            lifecycle.phases.forEach { phase ->
                result.add(phase)
            }
        }
        return result
    }

    private fun createGoalTarget(
        mavenCommand: String,
        project: MavenProject,
        cleanPluginName: String,
        goalName: String
    ): Pair<String, ObjectNode> {
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

    private fun getGoals(plugin: Plugin): Set<String> {
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
