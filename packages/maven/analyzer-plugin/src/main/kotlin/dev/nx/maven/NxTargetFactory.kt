package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.model.Plugin
import org.apache.maven.model.PluginExecution
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor
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
    private val pluginManager: MavenPluginManager,
    private val session: MavenSession,
    private val phaseAnalyzer: PhaseAnalyzer
) {
    private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)

    fun createNxTargets(
        mavenCommand: String, project: MavenProject
    ): Pair<ObjectNode, ObjectNode> {
        val nxTargets = objectMapper.createObjectNode()
        val targetGroups = mutableMapOf<String, List<String>>()

        val phaseDependsOn = mutableMapOf<String, MutableList<String>>()

        val phaseTargets = mutableMapOf<String, NxTarget>()
        // Extract discovered phases from lifecycle analysis
        lifecycles.lifeCycles.forEach { lifecycle ->
            log.info(
                "Analyzing ${lifecycle.phases.size} phases for ${project.artifactId}: ${
                    lifecycle.phases.joinToString(
                        ", "
                    )
                }"
            )

            val hasInstall = lifecycle.phases.contains("install")

            lifecycle.phases.forEachIndexed { index, phase ->
                val target = createPhaseTarget(project, phase, mavenCommand)


                phaseDependsOn[phase] = mutableListOf()
                target.dependsOn = target.dependsOn ?: objectMapper.createArrayNode()

                // find previous phase and add to dependsOn
                if (index > 1) {
                    val previousPhase = lifecycle.phases[index - 1]
                    target.dependsOn?.add(previousPhase)
                    phaseDependsOn[phase]?.add(previousPhase)
                }

                if (hasInstall) {
                    target.dependsOn?.add("^install")
                    phaseDependsOn[phase]?.add("^install")
                }

                target.dependsOn?.add("^$phase")
                phaseDependsOn[phase]?.add("^$phase")

                phaseTargets[phase] = target;

            }
        }

        // Extract discovered plugin goals
        val plugins = getExecutablePlugins(project)
        plugins.forEach { plugin: Plugin ->
            val pluginDescriptor = getPluginDescriptor(plugin, project)
            val goalPrefix = pluginDescriptor.goalPrefix
            val pluginTargetGroup = mutableListOf<String>()
            plugin.executions.forEach { execution ->
                execution.goals.forEach { goal ->

                    // Skip build-helper attach-artifact goal as it's not relevant for Nx
                    if (goalPrefix == "org.codehaus.mojo.build-helper" && goal == "attach-artifact") {
                        return@forEach
                    }

                    val goalTargetName = "$goalPrefix:$goal@${execution.id}"
                    val goalTarget = createGoalTarget(mavenCommand, project, goalPrefix, goal, execution)

                    val phase = execution.phase ?: pluginDescriptor.getMojo(goal)?.phase

                    // Normalize Maven 3 phase names to Maven 4 for backward compatibility
                    val normalizedPhase = when (phase) {
                        "generate-sources" -> "sources"
                        "process-sources" -> "after:sources"
                        "generate-resources" -> "resources"
                        "process-resources" -> "after:resources"
                        "generate-test-sources" -> "test-sources"
                        "process-test-sources" -> "after:test-sources"
                        "generate-test-resources" -> "test-resources"
                        "process-test-resources" -> "after:test-resources"
                        else -> phase
                    }

                    val phaseTarget = phaseTargets[normalizedPhase]
                    phaseTarget?.dependsOn?.add(goalTargetName)

                    val dependsOn = objectMapper.createArrayNode()
                    phaseDependsOn[normalizedPhase]?.forEach { dependency ->
                        dependsOn.add(dependency)
                    }
                    goalTarget.dependsOn = dependsOn

                    pluginTargetGroup.add(goalTargetName)
                    nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))
                }
            }
            targetGroups[goalPrefix] = pluginTargetGroup
        }

        val atomizedTestTargets = generateAtomizedTestTargets(project, mavenCommand)

        atomizedTestTargets.forEach { (goal, target) ->
            nxTargets.set<ObjectNode>(goal, target.toJSON(objectMapper))
        }
        targetGroups["verify-ci"] = atomizedTestTargets.keys.toList()

        val mavenPhasesGroup = mutableListOf<String>()
        phaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
            mavenPhasesGroup.add(phase)
        }
        targetGroups["maven-phases"] = mavenPhasesGroup

        val targetGroupsJson = objectMapper.createObjectNode()
        targetGroups.forEach { (groupName, targets) ->
            val targetsArray = objectMapper.createArrayNode()
            targets.forEach { target -> targetsArray.add(target) }
            targetGroupsJson.set<ArrayNode>(groupName, targetsArray)
        }

        return Pair(nxTargets, targetGroupsJson)
    }

    private fun createPhaseTarget(
        project: MavenProject, phase: String, mavenCommand: String
    ): NxTarget {
//        val analysis = phaseAnalyzer.analyze(project, phase)


        val options = objectMapper.createObjectNode()
        options.put(
            "command", "$mavenCommand $phase -pl ${project.groupId}:${project.artifactId} --batch-mode --resume"
        )
//        val target = NxTarget("nx:run-commands", options, analysis.isCacheable, analysis.isThreadSafe)
        val target = NxTarget("nx:noop", null, false, true)

        val dependsOn = objectMapper.createArrayNode()
        dependsOn.add("^$phase")
        target.dependsOn = dependsOn

        // Copy caching info from analysis
//        if (analysis.isCacheable) {
//
//            // Convert inputs to JsonNode array
//            val inputsArray = objectMapper.createArrayNode()
//            analysis.inputs.forEach { input -> inputsArray.add(input) }
//            target.inputs = inputsArray
//
//            // Convert outputs to JsonNode array
//            val outputsArray = objectMapper.createArrayNode()
//            analysis.outputs.forEach { output -> outputsArray.add(output) }
//            target.outputs = outputsArray
//        }

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

    private fun createGoalTarget(
        mavenCommand: String,
        project: MavenProject,
        cleanPluginName: String,
        goalName: String,
        execution: PluginExecution
    ): NxTarget {
        val options = objectMapper.createObjectNode()
        val command = if (goalName == "install" && cleanPluginName == "install") {
            if (project.packaging != "pom") {
                val fileExtension = project.artifact.type
                val artifactFile = "${project.build.directory}/${project.build.finalName}.${fileExtension}"

                "$mavenCommand install:install-file -Dfile=$artifactFile -DgroupId=${project.groupId} -DartifactId=${project.artifactId} -Dversion=${project.version} -Dpackaging=${project.packaging} -X -e"
            } else {
                "$mavenCommand $cleanPluginName:$goalName@${execution.id} -pl ${project.groupId}:${project.artifactId} -N -X -e"
            }
        } else {
            "$mavenCommand $cleanPluginName:$goalName@${execution.id} -pl ${project.groupId}:${project.artifactId} -N -X -e"
        }
        options.put(
            "command", command
        )

        return NxTarget("nx:run-commands", options, false, true)
    }


    /**
     * Clean plugin name for better target naming
     */
    private fun cleanPluginName(plugin: Plugin): String {
        val fullPluginName = "${plugin.groupId}.${plugin.artifactId}"
        return fullPluginName.replace("org.apache.maven.plugins.", "").replace("maven-", "").replace("-plugin", "")
    }

    private fun getPluginDescriptor(
        plugin: Plugin,
        project: MavenProject
    ): PluginDescriptor = pluginManager.getPluginDescriptor(
        plugin, project.remotePluginRepositories, session.repositorySession
    )
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
