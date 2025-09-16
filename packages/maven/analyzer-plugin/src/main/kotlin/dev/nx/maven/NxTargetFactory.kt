package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
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
    private val objectMapper: ObjectMapper,
    private val testClassDiscovery: TestClassDiscovery,
    private val phaseAnalyzer: PhaseAnalyzer
) {
    private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)

    fun createNxTargets(
        mavenCommand: String, project: MavenProject
    ): Pair<ObjectNode, ObjectNode> {
        val nxTargets = objectMapper.createObjectNode()
        val targetGroups = mutableMapOf<String, List<String>>()

        val phaseTargets = generatePhaseTargets(project, mavenCommand)
        val mavenPhasesGroup = mutableListOf<String>()
        phaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
            mavenPhasesGroup.add(phase)
        }
        targetGroups["maven-phases"] = mavenPhasesGroup

        // Extract discovered plugin goals
        val plugins = getExecutablePlugins(project)
        plugins.forEach { plugin: Plugin ->
            val goals = getGoals(plugin)
            val pluginTargetGroup = mutableListOf<String>()
            val cleanPluginName = cleanPluginName(plugin)
            goals.forEach { goal ->
                val goalTargetName = "$cleanPluginName:$goal"
                val goalTarget = createGoalTarget(mavenCommand, project, cleanPluginName, goal)
                pluginTargetGroup.add(goalTargetName)
                nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))
            }
            targetGroups[cleanPluginName] = pluginTargetGroup
        }

        val atomizedTestTargets = generateAtomizedTestTargets(project, mavenCommand)

        atomizedTestTargets.forEach { (goal, target) ->
            nxTargets.set<ObjectNode>(goal, target.toJSON(objectMapper))
        }
        targetGroups["verify-ci"] = atomizedTestTargets.keys.toList()

        val targetGroupsJson = objectMapper.createObjectNode()
        targetGroups.forEach { (groupName, targets) ->
            val targetsArray = objectMapper.createArrayNode()
            targets.forEach { target -> targetsArray.add(target) }
            targetGroupsJson.set<ArrayNode>(groupName, targetsArray)
        }

        return Pair(nxTargets, targetGroupsJson)
    }

    private fun generatePhaseTargets(
        project: MavenProject,
        mavenCommand: String,
    ): Map<String, NxTarget> {
        val targets = mutableMapOf<String, NxTarget>()
        // Extract discovered phases from lifecycle analysis
        val phasesToAnalyze = getPhases()

        log.info("Analyzing ${phasesToAnalyze.size} phases for ${project.artifactId}: ${phasesToAnalyze.joinToString(", ")}")

        // Generate targets from phase analysis
        phasesToAnalyze.forEach { phase ->
            targets[phase] = createPhaseTarget(project, phase, mavenCommand)
        }
        return targets
    }

    private fun createPhaseTarget(
        project: MavenProject, phase: String, mavenCommand: String
    ): NxTarget {
        val analysis = phaseAnalyzer.analyze(project, phase)


        val options = objectMapper.createObjectNode()
        options.put("command", "$mavenCommand $phase -am -pl ${project.groupId}:${project.artifactId}")
        val target = NxTarget("nx:run-commands", options, analysis.isCacheable, analysis.isThreadSafe)

        val dependsOn = objectMapper.createArrayNode()
        dependsOn.add("^$phase")
        target.dependsOn = dependsOn

        // Copy caching info from analysis
        if (analysis.isCacheable) {

            // Convert inputs to JsonNode array
            val inputsArray = objectMapper.createArrayNode()
            analysis.inputs.forEach { input -> inputsArray.add(input) }
            target.inputs = inputsArray

            // Convert outputs to JsonNode array
            val outputsArray = objectMapper.createArrayNode()
            analysis.outputs.forEach { output -> outputsArray.add(output) }
            target.outputs = outputsArray
        }

        return target
    }

    private fun getExecutablePlugins(project: MavenProject): List<Plugin> {
        return project.build.plugins
    }

    private fun generateAtomizedTestTargets(
        project: MavenProject, mavenCommand: String
    ): Map<String, NxTarget> {
        val targets = mutableMapOf<String, NxTarget>()

        val testClasses = testClassDiscovery.discoverTestClasses(project)
        val verifyCiTargetGroup = mutableListOf<String>()

        val verifyCiTarget = NxTarget("nx:noop", null, true, false)
        val verifyCiDependsOn = objectMapper.createArrayNode()

        verifyCiDependsOn.add("package")

        testClasses.forEach { testClass ->
            val targetName = "test--${testClass.packagePath}.${testClass.className}"

            verifyCiTargetGroup.add(targetName)

            log.info("Generating target for test class: $targetName'")

            val options = objectMapper.createObjectNode()
            options.put(
                "command",
                "$mavenCommand test -am -pl ${project.groupId}:${project.artifactId} -Dtest=${testClass.packagePath}.${testClass.className} -Dsurefire.failIfNoSpecifiedTests=false"
            )
            val target = NxTarget("nx:run-commands", options, false, false)

            verifyCiDependsOn.add(targetName)
            targets[targetName] = target
        }

        verifyCiTarget.dependsOn = verifyCiDependsOn
        targets["verify-ci"] = verifyCiTarget

        return targets
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
        mavenCommand: String, project: MavenProject, cleanPluginName: String, goalName: String
    ): NxTarget {
        val options = objectMapper.createObjectNode()
        options.put(
            "command", "$mavenCommand $cleanPluginName:$goalName -am -pl ${project.groupId}:${project.artifactId}"
        )

        return NxTarget("nx:run-commands", options, false, false)
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
        return fullPluginName.replace("org.apache.maven.plugins.", "").replace("maven-", "").replace("-plugin", "")
    }
}

data class NxTarget(
    val executor: String,
    val options: ObjectNode?,
    val cache: Boolean,
    val parallelism: Boolean,
    var dependsOn: ArrayNode? = null,
    var outputs: ArrayNode? = null,
    var inputs: ArrayNode? = null
) {
    fun toJSON(objectMapper: ObjectMapper): ObjectNode {
        val node = objectMapper.createObjectNode()
        node.put("executor", executor)
        if (options != null) {
            node.set<ObjectNode>("options", options)
        }
        node.put("cache", cache)
        node.put("parallelism", parallelism)

        dependsOn?.let { node.set<ObjectNode>("dependsOn", it) }
        outputs?.let { node.set<ObjectNode>("outputs", it) }
        inputs?.let { node.set<ObjectNode>("inputs", it) }

        return node
    }
}
