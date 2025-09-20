package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.model.Plugin
import org.apache.maven.model.PluginExecution
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
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
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver,
    private val pluginKnowledge: PluginKnowledge
) {
    private val log: Logger = LoggerFactory.getLogger(NxTargetFactory::class.java)

    // All goals now get build state management for maximum compatibility
    private fun shouldApplyBuildState(goalKey: String): Boolean = true
    private fun shouldRecordBuildState(goalKey: String): Boolean = true

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

                // Add dependency on immediate previous phase (if exists)
                if (index > 0) {
                    val previousPhase = lifecycle.phases[index - 1]
                    target.dependsOn?.add(previousPhase)
                    phaseDependsOn[phase]?.add(previousPhase)
                    log.info("Phase '$phase' depends on previous phase: '$previousPhase'")
                }

                if (hasInstall) {
                    target.dependsOn?.add("^install")
                    phaseDependsOn[phase]?.add("^install")
                }

//                target.dependsOn?.add("^$phase")
//                phaseDependsOn[phase]?.add("^$phase")

                phaseTargets[phase] = target

                if (hasGoals) {
                    log.info("Created phase target '$phase' with ${goalsForPhase?.size ?: 0} goals")
                } else {
                    log.info("Created noop phase target '$phase' (no goals)")
                }
            }
        }

        // Also create individual goal targets for granular execution
        plugins.forEach { plugin: Plugin ->
            val pluginDescriptor = getPluginDescriptor(plugin, project)
            val goalPrefix = pluginDescriptor.goalPrefix

            plugin.executions.forEach { execution ->
                execution.goals.forEach { goal ->
                    // Skip build-helper attach-artifact goal as it's not relevant for Nx
                    if (goalPrefix == "org.codehaus.mojo.build-helper" && goal == "attach-artifact") {
                        return@forEach
                    }

                    val goalTargetName = "$goalPrefix:$goal@${execution.id}"
                    val mojoDescriptor = pluginDescriptor.getMojo(goal)

                    val goalTarget =
                        createSimpleGoalTarget(mavenCommand, project, goalPrefix, goal, execution, mojoDescriptor)
                    nxTargets.set<ObjectNode>(goalTargetName, goalTarget.toJSON(objectMapper))

                    log.info("Created individual goal target: $goalTargetName")
                }
            }
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
        project: MavenProject, phase: String, mavenCommand: String, goals: List<String>
    ): NxTarget {
        // Inline analysis logic from PhaseAnalyzer
        val plugins = project.build.plugins
        var isThreadSafe = true
        var isCacheable = true
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        data class ExecutionContext(
            val plugin: Plugin,
            val executionId: String,
            val goal: String,
            val descriptor: MojoDescriptor
        )

        val executionContexts = plugins
            .flatMap { plugin ->
                plugin.executions
                    .filter { execution -> execution.phase == phase }
                    .flatMap { execution ->
                        log.info("Analyzing ${project.groupId}:${project.artifactId} execution: ${execution.id} -> phase: ${execution.phase}, goals: ${execution.goals}")

                        execution.goals.mapNotNull { goal ->
                            getMojoDescriptor(plugin, goal, project)?.let { descriptor ->
                                ExecutionContext(plugin, execution.id, goal, descriptor)
                            }
                        }
                    }
            }

        // Transform all execution contexts to analysis results in parallel, then aggregate on main thread
        val analysisResults = executionContexts.parallelStream().map { context ->
            val descriptorThreadSafe = context.descriptor.isThreadSafe
            val descriptorCacheable = isMojoCacheable(context.descriptor)

            val parameterInfos = context.descriptor.parameters?.parallelStream()?.map { parameter ->
                val paramInfo = analyzeParameterInputsOutputs(context.descriptor, parameter, project, context.executionId)
                log.debug("Parameter analysis: ${context.descriptor.phase} ${parameter.name} -> ${paramInfo}")
                paramInfo
            }?.collect(java.util.stream.Collectors.toList()) ?: emptyList()

            Triple(descriptorThreadSafe, descriptorCacheable, parameterInfos)
        }.collect(java.util.stream.Collectors.toList())

        // Aggregate results on main thread (no synchronization needed)
        analysisResults.forEach { (descriptorThreadSafe, descriptorCacheable, parameterInfos) ->
            if (!descriptorThreadSafe) {
                isThreadSafe = false
            }
            if (!descriptorCacheable) {
                isCacheable = false
            }
            parameterInfos.forEach { paramInfo ->
                inputs.addAll(paramInfo.inputs)
                outputs.addAll(paramInfo.outputs)
            }
        }

        log.info("Phase $phase analysis: thread safe: $isThreadSafe, cacheable: $isCacheable, inputs: $inputs, outputs: $outputs")

        val options = objectMapper.createObjectNode()

        // Build command with goals bundled together
        val commandParts = mutableListOf<String>()
        commandParts.add(mavenCommand)

        // Add build state apply if needed (before goals)
        if (shouldApplyBuildState("$phase-goals")) {
            commandParts.add("dev.nx.maven:nx-maven-plugin:apply")
        }

        // Add all goals for this phase
        commandParts.addAll(goals)

        // Add build state record if needed (after goals)
        if (shouldRecordBuildState("$phase-goals")) {
            commandParts.add("dev.nx.maven:nx-maven-plugin:record")
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
        goalPrefix: String,
        goalName: String,
        execution: PluginExecution,
        mojoDescriptor: MojoDescriptor?
    ): NxTarget {
        val options = objectMapper.createObjectNode()

        // Simple command without nx:apply/nx:record
        val command =
            "$mavenCommand $goalPrefix:$goalName@${execution.id} -pl ${project.groupId}:${project.artifactId} -N --batch-mode"
        options.put("command", command)

        // No dependencies for goal targets - they can run independently
        return NxTarget("nx:run-commands", options, false, mojoDescriptor?.isThreadSafe ?: true)
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


    /**
     * Analyzes parameter to determine inputs and outputs
     */
    private fun analyzeParameterInputsOutputs(descriptor: MojoDescriptor, parameter: Parameter, project: MavenProject, executionId: String? = null): ParameterInformation {
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val role = analyzeParameterRole(descriptor, parameter, executionId)

        if (role == ParameterRole.UNKNOWN) {
            log.debug("Skipping unknown parameter: ${parameter.name}")
            return ParameterInformation(inputs, outputs)
        }

        val path = expressionResolver.resolveParameterValue(
            parameter.name,
            parameter.defaultValue,
            parameter.expression,
            project
        )

        if (path == null) {
            log.debug("Parameter ${parameter.name} resolved to null path")
            return ParameterInformation(inputs, outputs)
        }

        when (role) {
            ParameterRole.INPUT -> {
                pathResolver.addInputPath(path, inputs)
                log.info("Added input path: $path (from parameter ${parameter.name})")
            }
            ParameterRole.OUTPUT -> {
                pathResolver.addOutputPath(path, outputs)
                log.info("Added output path: $path (from parameter ${parameter.name})")
            }
            ParameterRole.BOTH -> {
                pathResolver.addInputPath(path, inputs)
                pathResolver.addOutputPath(path, outputs)
                log.debug("Added input/output path: $path (from parameter ${parameter.name})")
            }
            ParameterRole.UNKNOWN -> {
                // Won't reach here due to early return above
            }
        }

        return ParameterInformation(inputs, outputs)
    }

    /**
     * Determines if a mojo can be safely cached based on Maven build cache configuration
     */
    private fun isMojoCacheable(descriptor: MojoDescriptor): Boolean {
        val artifactId = descriptor.pluginDescriptor?.artifactId

        // Check if plugin should always run (never cached)
        if (pluginKnowledge.shouldAlwaysRun(artifactId)) {
            log.debug("Plugin $artifactId should always run - not cacheable")
            return false
        }

        // Default: cacheable (Maven build cache extension default behavior)
        log.debug("Plugin $artifactId:${descriptor.goal} is cacheable by default")
        return true
    }

    private fun analyzeParameterRole(descriptor: MojoDescriptor, parameter: Parameter, executionId: String? = null): ParameterRole {
        val name = parameter.name

        // Only use plugin knowledge - no heuristics
        val pluginArtifactId = descriptor.pluginDescriptor?.artifactId
        val goal = descriptor.goal
        val knownRole = pluginKnowledge.getParameterRole(pluginArtifactId, executionId ?: "default-${goal}", name)

        if (knownRole != null) {
            log.debug("Parameter $name: Found in plugin knowledge for $pluginArtifactId:$goal -> $knownRole")
            return knownRole
        }

        log.debug("Parameter $name: Not found in plugin knowledge")
        return ParameterRole.UNKNOWN
    }

    private fun getMojoDescriptor(plugin: Plugin, goal: String, project: MavenProject): MojoDescriptor? {
        return try {
            val pluginDescriptor = pluginManager.getPluginDescriptor(
                plugin,
                project.remotePluginRepositories,
                session.repositorySession
            )
            pluginDescriptor?.getMojo(goal)
        } catch (e: Exception) {
            log.warn("Failed to get MojoDescriptor for plugin ${plugin.artifactId} and goal $goal: ${e.message}")
            null
        }
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
