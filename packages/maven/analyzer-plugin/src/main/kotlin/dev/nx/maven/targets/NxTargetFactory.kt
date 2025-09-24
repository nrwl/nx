package dev.nx.maven.targets

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import dev.nx.maven.utils.MojoAnalyzer
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.model.Plugin
import org.apache.maven.model.PluginExecution
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory

private const val APPLY_GOAL = "dev.nx.maven:nx-maven-plugin:apply"

private const val RECORD_GOAL = "dev.nx.maven:nx-maven-plugin:record"

/**
 * Collects lifecycle and plugin information directly from Maven APIs
 */
class NxTargetFactory(
    private val lifecycles: DefaultLifecycles,
    private val objectMapper: ObjectMapper,
    private val testClassDiscovery: TestClassDiscovery,
    private val pluginManager: MavenPluginManager,
    private val session: MavenSession,
    private val mojoAnalyzer: MojoAnalyzer
) {
    private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)

    // All goals now get build state management for maximum compatibility
    private fun shouldApplyBuildState(): Boolean = true
    private fun shouldRecordBuildState(): Boolean = true

    /**
     * Normalizes Maven 3 phase names to Maven 4 equivalents when running Maven 4.
     * Returns the original phase name when running Maven 3.
     */
    private fun normalizePhase(phase: String?): String? {
        if (phase == null) return null

        val mavenVersion = session.systemProperties.getProperty("maven.version") ?: ""
        if (!mavenVersion.startsWith("4")) {
            return phase // Keep original phase names for Maven 3
        }

        return when (phase) {
            "generate-sources" -> "sources"
            "process-sources" -> "after:sources"
            "generate-resources" -> "resources"
            "process-resources" -> "after:resources"
            "process-classes" -> "after:compile"
            "generate-test-sources" -> "test-sources"
            "process-test-sources" -> "after:test-sources"
            "generate-test-resources" -> "test-resources"
            "process-test-resources" -> "after:test-resources"
            "process-test-classes" -> "after:test-compile"
            "prepare-package" -> "before:package"
            "pre-integration-test" -> "before:integration-test"
            "post-integration-test" -> "after:integration-test"
            else -> phase
        }
    }


    fun createNxTargets(
        mavenCommand: String, project: MavenProject
    ): Pair<ObjectNode, ObjectNode> {
        val nxTargets = objectMapper.createObjectNode()
        val targetGroups = mutableMapOf<String, List<String>>()

        val phaseDependsOn = mutableMapOf<String, MutableList<String>>()
        val phaseGoals = mutableMapOf<String, MutableList<String>>()

        // First pass: collect all goals by phase from plugin executions
        val plugins = getExecutablePlugins(project)
        plugins.forEach { plugin: Plugin ->
            val pluginDescriptor = getPluginDescriptor(plugin, project)
            val goalPrefix = pluginDescriptor.goalPrefix

            plugin.executions.forEach { execution ->
                execution.goals.forEach { goal ->
                    // Skip build-helper attach-artifact goal as it's not relevant for Nx
                    if (goalPrefix == "org.codehaus.mojo.build-helper" && goal == "attach-artifact") {
                        return@forEach
                    }

                    val mojoDescriptor = pluginDescriptor.getMojo(goal)
                    val phase = execution.phase ?: mojoDescriptor?.phase

                    val normalizedPhase = normalizePhase(phase)

                    if (normalizedPhase != null) {
                        val goalSpec = "$goalPrefix:$goal@${execution.id}"
                        phaseGoals.computeIfAbsent(normalizedPhase) { mutableListOf() }.add(goalSpec)
                        log.info("Added goal $goalSpec to phase $normalizedPhase")
                    }
                }
            }
        }

        val phaseTargets = mutableMapOf<String, NxTarget>()
        val ciPhaseTargets = mutableMapOf<String, NxTarget>()
        // Create phase targets from lifecycle, but only for phases that have goals
        lifecycles.lifeCycles.forEach { lifecycle ->
            log.info(
                "Analyzing ${lifecycle.phases.size} phases for ${project.artifactId}: ${
                    lifecycle.phases.joinToString(
                        ", "
                    )
                }"
            )

            val hasInstall = lifecycle.phases.contains("install")
            val testIndex = lifecycle.phases.indexOf("test")

            lifecycle.phases.forEachIndexed { index, phase ->
                val goalsForPhase = phaseGoals[phase]
                val hasGoals = goalsForPhase?.isNotEmpty() == true

                // Create target for all phases - either with goals or as noop
                val target = if (hasGoals) {
                    createPhaseTarget(project, phase, mavenCommand, goalsForPhase!!)
                } else {
                    createNoopPhaseTarget(phase)
                }

                phaseDependsOn[phase] = mutableListOf()
                target.dependsOn = target.dependsOn ?: objectMapper.createArrayNode()

                if (hasInstall) {
                    target.dependsOn?.add("^install")
                    phaseDependsOn[phase]?.add("^install")
                }

                // Add dependency on immediate previous phase (if exists)
                val previousPhase = lifecycle.phases.getOrNull(index - 1)
                if (previousPhase != null) {
                    target.dependsOn?.add(previousPhase)
                    phaseDependsOn[phase]?.add(previousPhase)
                }

                phaseTargets[phase] = target

//                    if (testIndex > -1 && index >= testIndex) {
                if (testIndex > -1) {
                    val ciPhaseName = "$phase-ci"
                    // Test and later phases get a CI counterpart

                    val ciTarget = if (hasGoals && phase !== "test") {
                        createPhaseTarget(project, phase, mavenCommand, goalsForPhase!!)
                    } else {
                        createNoopPhaseTarget(phase)
                    }
                    val ciPhaseDependsOn = mutableListOf<String>()

                    if (previousPhase != null) {
                        ciPhaseDependsOn.add("$previousPhase-ci")
                        log.info("Phase '$phase' depends on previous phase: '$previousPhase'")
                    }

                    if (hasInstall) {
                        ciPhaseDependsOn.add("^install-ci")
                    }

                    ciTarget.dependsOn = ciTarget.dependsOn ?: objectMapper.createArrayNode()
                    ciPhaseDependsOn.forEach {
                        ciTarget.dependsOn?.add(it)
                    }

                    phaseDependsOn[ciPhaseName] = ciPhaseDependsOn
                    ciPhaseTargets[ciPhaseName] = ciTarget
                }

//                target.dependsOn?.add("^$phase")
//                phaseDependsOn[phase]?.add("^$phase")

                if (hasGoals) {
                    log.info("Created phase target '$phase' with ${goalsForPhase?.size ?: 0} goals")
                } else {
                    log.info("Created noop phase target '$phase' (no goals)")
                }
            }
        }

        // Also create individual goal targets for granular execution
        plugins.forEach { plugin: Plugin ->
            val pluginDescriptor = runCatching { getPluginDescriptor(plugin, project) }
                .getOrElse { throwable ->
                    log.warn(
                        "Failed to resolve plugin descriptor for ${plugin.groupId}:${plugin.artifactId}: ${throwable.message}"
                    )
                    return@forEach
                }
            val goalPrefix = pluginDescriptor.goalPrefix

            plugin.executions.forEach { execution ->
                execution.goals.forEach { goal ->
                    // Skip build-helper attach-artifact goal as it's not relevant for Nx
                    if (goalPrefix == "org.codehaus.mojo.build-helper" && goal == "attach-artifact") {
                        return@forEach
                    }

                    val goalTargetName = "$goalPrefix:$goal@${execution.id}"
                    val goalTarget = createSimpleGoalTarget(
                        mavenCommand,
                        project,
                        pluginDescriptor,
                        goalPrefix,
                        goal,
                        execution
                    ) ?: return@forEach
                    nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))

                    log.info("Created individual goal target: $goalTargetName")
                }
            }
        }

        val mavenPhasesGroup = mutableListOf<String>()
        phaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
            mavenPhasesGroup.add(phase)
        }
        targetGroups["Phases"] = mavenPhasesGroup

        val ciPhasesGroup = mutableListOf<String>()
        ciPhaseTargets.forEach { (phase, target) ->
            nxTargets.set<ObjectNode>(phase, target.toJSON(objectMapper))
            ciPhasesGroup.add(phase)
        }
        targetGroups["CI Phases"] = ciPhasesGroup

        if (phaseGoals.contains("test")) {
            val atomizedTestTargets = generateAtomizedTestTargets(project, mavenCommand, ciPhaseTargets["test-ci"]!!, phaseGoals["test"]!!, phaseDependsOn["test-ci"]!!)

            atomizedTestTargets.forEach { (goal, target) ->
                nxTargets.set<ObjectNode>(goal, target.toJSON(objectMapper))
            }
            targetGroups["Test CI"] = atomizedTestTargets.keys.toList()
        } else {
            log.info("No test goals found for project ${project.artifactId}, skipping atomized test target generation")
        }

        val targetGroupsJson = objectMapper.createObjectNode()
        targetGroups.forEach { (groupName, targets) ->
            val targetsArray = objectMapper.createArrayNode()
            targets.forEach { target -> targetsArray.add(target) }
            targetGroupsJson.set<ArrayNode>(groupName, targetsArray)
        }

        return Pair(nxTargets, targetGroupsJson)
    }

    private fun createPhaseTarget(
        project: MavenProject, phase: String, mavenCommand: String, goals: List<String>
    ): NxTarget {
        // Inline analysis logic from PhaseAnalyzer
        val plugins = project.build.plugins
        var isThreadSafe = true
        var isCacheable = true
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val analyses = plugins
            .flatMap { plugin ->
                val pluginDescriptor = runCatching { getPluginDescriptor(plugin, project) }
                    .getOrElse { throwable ->
                        log.warn(
                            "Failed to resolve plugin descriptor for ${plugin.groupId}:${plugin.artifactId}: ${throwable.message}"
                        )
                        return@flatMap emptyList()
                    }

                plugin.executions
                    .filter { execution -> execution.phase == phase }
                    .flatMap { execution ->
                        log.info(
                            "Analyzing ${project.groupId}:${project.artifactId} execution: ${execution.id} -> phase: ${execution.phase}, goals: ${execution.goals}"
                        )

                        execution.goals.filterNotNull().mapNotNull { goal ->
                            mojoAnalyzer.analyzeMojo(pluginDescriptor, goal, project)
                        }
                    }
            }

        // Aggregate analysis results
        analyses.forEach { analysis ->

            if (!analysis.isThreadSafe) {
                isThreadSafe = false
            }
            if (!analysis.isCacheable) {
                isCacheable = false
            }

            inputs.addAll(analysis.inputs)
            outputs.addAll(analysis.outputs)
        }

        // Add Maven convention fallbacks if no inputs/outputs were found
        if (inputs.isEmpty()) {
            inputs.addAll(mojoAnalyzer.mavenFallbackInputs)
        }
        if (outputs.isEmpty()) {
            outputs.addAll(mojoAnalyzer.mavenFallbackOutputs)
        }

        log.info("Phase $phase analysis: thread safe: $isThreadSafe, cacheable: $isCacheable, inputs: $inputs, outputs: $outputs")

        val options = objectMapper.createObjectNode()

        // Build command with goals bundled together
        val commandParts = mutableListOf<String>()
        commandParts.add(mavenCommand)

        // Add build state apply if needed (before goals)
        if (shouldApplyBuildState()) {
            commandParts.add(APPLY_GOAL)
        }

        // Add all goals for this phase
        commandParts.addAll(goals)

        // Add build state record if needed (after goals)
        if (shouldRecordBuildState()) {
            commandParts.add(RECORD_GOAL)
        }

        // Add project selection and non-recursive flag
        commandParts.add("-pl")
        commandParts.add("${project.groupId}:${project.artifactId}")
        commandParts.add("-N")
        commandParts.add("--batch-mode")

        val command = commandParts.joinToString(" ")
        options.put("command", command)

        log.info("Created phase target '$phase' with command: $command")

        val target = NxTarget("nx:run-commands", options, isCacheable, isThreadSafe)

        // Copy caching info from analysis
        if (isCacheable) {
            // Convert inputs to JsonNode array
            val inputsArray = objectMapper.createArrayNode()
            inputs.forEach { input -> inputsArray.add(input) }
            target.inputs = inputsArray

            // Convert outputs to JsonNode array
            val outputsArray = objectMapper.createArrayNode()
            outputs.forEach { output -> outputsArray.add(output) }
            target.outputs = outputsArray
        }

        return target
    }

    private fun createNoopPhaseTarget(
        phase: String
    ): NxTarget {
        log.info("Creating noop target for phase '$phase' (no goals)")
        return NxTarget("nx:noop", null, cache = true, parallelism = true)
    }

    private fun createSimpleGoalTarget(
        mavenCommand: String,
        project: MavenProject,
        pluginDescriptor: PluginDescriptor,
        goalPrefix: String,
        goalName: String,
        execution: PluginExecution
    ): NxTarget? {
        val options = objectMapper.createObjectNode()

        // Simple command without nx:apply/nx:record
        val command =
            "$mavenCommand $goalPrefix:$goalName@${execution.id} -pl ${project.groupId}:${project.artifactId} -N --batch-mode"
        options.put("command", command)
        val analysis = mojoAnalyzer.analyzeMojo(pluginDescriptor, goalName, project)
            ?: return null

        val target = NxTarget("nx:run-commands", options, analysis.isCacheable, analysis.isThreadSafe)

        // Add inputs and outputs if cacheable
        if (analysis.isCacheable) {
            // Convert inputs to JsonNode array
            val inputsArray = objectMapper.createArrayNode()
            analysis.inputs.forEach { input -> inputsArray.add(input) }
            analysis.dependentTaskOutputInputs.forEach { input ->
                val obj = objectMapper.createObjectNode()
                obj.put("dependentTasksOutputFiles", input.path)
                if (input.transitive) obj.put("transitive", true)
                inputsArray.add(obj)
            }
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
        project: MavenProject, mavenCommand: String, testCiTarget: NxTarget, testGoals: MutableList<String>, testDependsOn: MutableList<String>
    ): Map<String, NxTarget> {
        val testGoal = testGoals.first()
        val targets = mutableMapOf<String, NxTarget>()

        val testClasses = testClassDiscovery.discoverTestClasses(project)
        val testCiTargetGroup = mutableListOf<String>()
        testClasses.forEach { testClass ->
            val targetName = "$testGoal--${testClass.packagePath}.${testClass.className}"

            log.info("Generating target for test class: $targetName'")

            val options = objectMapper.createObjectNode()
            options.put(
                "command",
                "$mavenCommand $APPLY_GOAL $testGoal $RECORD_GOAL -pl ${project.groupId}:${project.artifactId} -Dtest=${testClass.packagePath}.${testClass.className} -Dsurefire.failIfNoSpecifiedTests=false"
            )

            val dependsOn = objectMapper.createArrayNode()
            testDependsOn.forEach { dependsOn.add(it) }

            val target = NxTarget("nx:run-commands", options, false, false, dependsOn)

            targets[targetName] = target



            testCiTargetGroup.add(targetName)

            testCiTarget.dependsOn!!.add(targetName)
        }

        return targets
    }


    private fun getPluginDescriptor(
        plugin: Plugin,
        project: MavenProject
    ): PluginDescriptor = pluginManager.getPluginDescriptor(
        plugin, project.remotePluginRepositories, session.repositorySession
    )
}
