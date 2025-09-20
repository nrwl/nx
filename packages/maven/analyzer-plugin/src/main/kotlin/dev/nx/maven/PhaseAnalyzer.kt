package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.model.Plugin
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.project.MavenProject
import org.slf4j.LoggerFactory

/**
 * Analyzes Maven phases to determine inputs, outputs, and thread safety
 */
class PhaseAnalyzer(
    private val pluginManager: MavenPluginManager,
    private val session: MavenSession,
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver,
    private val pluginKnowledge: PluginKnowledge
) {
    private val log = LoggerFactory.getLogger(PhaseAnalyzer::class.java)

    fun analyze(project: MavenProject, phase: String): PhaseInformation {

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

            MojoAnalysisResult(descriptorThreadSafe, descriptorCacheable, parameterInfos)
        }.collect(java.util.stream.Collectors.toList())

        // Aggregate results on main thread (no synchronization needed)
        analysisResults.forEach { result ->
            if (!result.isThreadSafe) {
                isThreadSafe = false
            }
            if (!result.isCacheable) {
                isCacheable = false
            }
            result.parameterInfos.forEach { paramInfo ->
                inputs.addAll(paramInfo.inputs)
                outputs.addAll(paramInfo.outputs)
            }
        }

        log.info("Phase $phase analysis: thread safe: $isThreadSafe, cacheable: $isCacheable, inputs: $inputs, outputs: $outputs")

        return PhaseInformation(isThreadSafe, isCacheable, inputs, outputs)
    }

    /**
     * Determines if a phase is inherently cacheable based on its name and purpose
     */
    private fun isPhaseCacheable(phase: String): Boolean {
        // Phases that are inherently non-cacheable due to side effects
        val nonCacheablePhases = setOf(
            // Clean lifecycle - modifies filesystem
            "pre-clean", "clean", "post-clean",

            // Deployment phases - network operations, side effects
            "install", "deploy", "site-deploy",

            // Interactive/execution phases
            "exec", "run"
        )

        if (nonCacheablePhases.contains(phase)) {
            log.debug("Phase '$phase' is inherently non-cacheable")
            return false
        }

        // Additional pattern-based checks
        when {
            phase.contains("deploy", ignoreCase = true) -> {
                log.debug("Phase '$phase' contains 'deploy' - marking as non-cacheable")
                return false
            }
            phase.contains("install", ignoreCase = true) -> {
                log.debug("Phase '$phase' contains 'install' - marking as non-cacheable")
                return false
            }
            phase.contains("clean", ignoreCase = true) -> {
                log.debug("Phase '$phase' contains 'clean' - marking as non-cacheable")
                return false
            }
        }

        log.debug("Phase '$phase' appears cacheable by default")
        return true
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
        val goal = descriptor.goal

        // Check if plugin should always run (never cached)
        if (pluginKnowledge.shouldAlwaysRun(artifactId)) {
            log.debug("Plugin $artifactId should always run - not cacheable")
            return false
        }

        // Default: cacheable (Maven build cache extension default behavior)
        log.debug("Plugin $artifactId:$goal is cacheable by default")
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

}

enum class ParameterRole {
    INPUT,      // Parameter represents input files/data
    OUTPUT,     // Parameter represents output files/data
    BOTH,       // Parameter can be both input and output
    UNKNOWN     // Unable to determine parameter role
}

data class ParameterInformation(
    val inputs: Set<String>,
    val outputs: Set<String>
)

data class MojoAnalysisResult(
    val isThreadSafe: Boolean,
    val isCacheable: Boolean,
    val parameterInfos: List<ParameterInformation>
)

data class PhaseInformation(
    val isThreadSafe: Boolean,
    val isCacheable: Boolean,
    val inputs: Set<String>,
    val outputs: Set<String>
)
