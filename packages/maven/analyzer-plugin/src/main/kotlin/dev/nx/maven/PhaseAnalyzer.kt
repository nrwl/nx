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
    private val gitIgnoreClassifier: GitIgnoreClassifier? = null
) {
    private val log = LoggerFactory.getLogger(PhaseAnalyzer::class.java)

    fun analyze(project: MavenProject, phase: String): PhaseInformation {

        val plugins = project.build.plugins
        var isThreadSafe = true
        var isCacheable = isPhaseCacheable(phase)
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val mojoDescriptors = plugins
            .flatMap { plugin ->
                plugin.executions
                    .filter { execution -> execution.phase == phase }
                    .flatMap { execution ->

                        log.info("Analyzing ${project.groupId}:${project.artifactId} execution: ${execution.id} -> phase: ${execution.phase}, goals: ${execution.goals}")

                        execution.goals }
                    .mapNotNull { goal -> getMojoDescriptor(plugin, goal, project) }
            }

        // Transform all descriptors to analysis results in parallel, then aggregate on main thread
        val analysisResults = mojoDescriptors.parallelStream().map { descriptor ->
            val descriptorThreadSafe = descriptor.isThreadSafe
            val descriptorCacheable = isMojoCacheable(descriptor)

            val parameterInfos = descriptor.parameters?.parallelStream()?.map { parameter ->
                val paramInfo = analyzeParameterInputsOutputs(descriptor, parameter, project)
                log.info("Parameter analysis: ${descriptor.phase} ${parameter.name} -> ${paramInfo}")
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
    private fun analyzeParameterInputsOutputs(descriptor: MojoDescriptor, parameter: Parameter, project: MavenProject): ParameterInformation {
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val role = analyzeParameterRole(parameter, project)


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
     * Determines if a mojo can be safely cached based on its characteristics
     */
    private fun isMojoCacheable(descriptor: MojoDescriptor): Boolean {
        val goal = descriptor.goal
        val artifactId = descriptor.pluginDescriptor?.artifactId ?: ""

        // Known non-cacheable plugins/goals
        val nonCacheablePatterns = listOf(
            // Network/deployment operations
            "deploy", "release", "site-deploy",
            // Interactive/time-sensitive operations
            "exec", "run", "start", "stop",
            // Cleaning operations
            "clean",
            // IDE integration
            "eclipse", "idea",
            // Help/info operations
            "help", "dependency:tree", "versions:display"
        )

        // Check if goal matches non-cacheable patterns
        if (nonCacheablePatterns.any { pattern ->
            goal.contains(pattern, ignoreCase = true) ||
            artifactId.contains(pattern, ignoreCase = true)
        }) {
            log.debug("Mojo $artifactId:$goal marked as non-cacheable due to goal/plugin pattern")
            return false
        }

        // Check for network-related parameters
        descriptor.parameters?.forEach { parameter ->
            val name = parameter.name.lowercase()
            val description = parameter.description?.lowercase() ?: ""

            if (hasNetworkIndicators(name, description)) {
                log.debug("Mojo $artifactId:$goal marked as non-cacheable due to network parameter: ${parameter.name}")
                return false
            }
        }

        // Check for time-sensitive operations
        if (hasTimeSensitiveIndicators(goal, artifactId)) {
            log.debug("Mojo $artifactId:$goal marked as non-cacheable due to time-sensitive operation")
            return false
        }

        log.debug("Mojo $artifactId:$goal appears cacheable")
        return true
    }

    private fun hasNetworkIndicators(name: String, description: String): Boolean {
        val networkKeywords = listOf(
            "url", "server", "host", "port", "repository", "endpoint",
            "deploy", "upload", "download", "remote", "publish"
        )

        return networkKeywords.any { keyword ->
            name.contains(keyword) || description.contains(keyword)
        }
    }

    private fun hasTimeSensitiveIndicators(goal: String, artifactId: String): Boolean {
        val timeSensitiveKeywords = listOf(
            "timestamp", "buildnumber", "time", "date",
            "git-commit", "scm", "build-info"
        )

        return timeSensitiveKeywords.any { keyword ->
            goal.contains(keyword, ignoreCase = true) ||
            artifactId.contains(keyword, ignoreCase = true)
        }
    }

    private fun analyzeParameterRole(parameter: Parameter, project: MavenProject): ParameterRole {
        val name = parameter.name
        val type = parameter.type
        val expression = parameter.expression ?: parameter.defaultValue ?: ""
        val description = parameter.description?.lowercase() ?: ""
        val isEditable = parameter.isEditable
        val isRequired = parameter.isRequired
        val alias = parameter.alias

        // Analyze Maven expressions (highest priority)
        when {
            expression.contains("project.compileSourceRoots") -> {
                log.debug("Parameter $name: Maven source roots expression")
                return ParameterRole.INPUT
            }
            expression.contains("project.testCompileSourceRoots") -> {
                log.debug("Parameter $name: Maven test source roots expression")
                return ParameterRole.INPUT
            }
            expression.contains("project.build.sourceDirectory") -> {
                log.debug("Parameter $name: Maven source directory expression")
                return ParameterRole.INPUT
            }
            expression.contains("project.build.testSourceDirectory") -> {
                log.debug("Parameter $name: Maven test source directory expression")
                return ParameterRole.INPUT
            }
            expression.contains("project.artifacts") -> {
                log.debug("Parameter $name: Project artifacts dependency")
                return ParameterRole.INPUT
            }
            expression.contains("project.dependencies") -> {
                log.debug("Parameter $name: Project dependencies")
                return ParameterRole.INPUT
            }
            expression.contains("project.build.resources") -> {
                log.debug("Parameter $name: Maven resources expression")
                return ParameterRole.INPUT
            }
            expression.contains("project.build.testResources") -> {
                log.debug("Parameter $name: Maven test resources expression")
                return ParameterRole.INPUT
            }
            expression.contains("basedir") -> {
                log.debug("Parameter $name: Project base directory")
                return ParameterRole.INPUT
            }
            expression.contains("project.build.directory") && expression.contains("target") -> {
                log.debug("Parameter $name: Maven target directory expression")
                return ParameterRole.OUTPUT
            }
            expression.contains("project.build.outputDirectory") -> {
                log.debug("Parameter $name: Maven output directory expression")
                return ParameterRole.OUTPUT
            }
            expression.contains("project.build.testOutputDirectory") -> {
                log.debug("Parameter $name: Maven test output directory expression")
                return ParameterRole.OUTPUT
            }
            expression.contains("project.reporting.outputDirectory") -> {
                log.debug("Parameter $name: Maven reporting output directory")
                return ParameterRole.OUTPUT
            }
            expression.contains("project.build.directory") -> {
                log.debug("Parameter $name: Maven build directory expression")
                return ParameterRole.OUTPUT
            }
        }

        // Type and editability analysis (medium priority)
        if (!isEditable) {
            log.debug("Parameter $name: Non-editable parameter (likely derived from project model)")
            return ParameterRole.INPUT
        }

        if (type.startsWith("java.util.List") && isRequired) {
            log.debug("Parameter $name: Required list parameter")
            return ParameterRole.INPUT
        }

        // Description analysis (lowest priority)
        when {
            description.contains("read") && (description.contains("file") || description.contains("directory")) -> {
                log.debug("Parameter $name: Description indicates reading files")
                return ParameterRole.INPUT
            }
            description.contains("source") && description.contains("directory") -> {
                log.debug("Parameter $name: Description mentions source directory")
                return ParameterRole.INPUT
            }
            description.contains("input") -> {
                log.debug("Parameter $name: Description mentions input")
                return ParameterRole.INPUT
            }
            description.contains("classpath") -> {
                log.debug("Parameter $name: Description mentions classpath")
                return ParameterRole.INPUT
            }
            description.contains("output") && (description.contains("file") || description.contains("directory")) -> {
                log.debug("Parameter $name: Description indicates output files")
                return ParameterRole.OUTPUT
            }
            description.contains("target") && description.contains("directory") -> {
                log.debug("Parameter $name: Description mentions target directory")
                return ParameterRole.OUTPUT
            }
            description.contains("generate") -> {
                log.debug("Parameter $name: Description mentions generating")
                return ParameterRole.OUTPUT
            }
            description.contains("destination") -> {
                log.debug("Parameter $name: Description mentions destination")
                return ParameterRole.OUTPUT
            }
        }

        // NEW: Check gitignore status as final fallback strategy
        val resolvedPath = expressionResolver.resolveParameterValue(
            name,
            parameter.defaultValue,
            expression,
            project
        )

        if (resolvedPath != null) {
            val gitIgnoreRole = gitIgnoreClassifier?.classifyPath(resolvedPath)
            if (gitIgnoreRole != null) {
                log.debug("Parameter $name: Gitignore classification suggests $gitIgnoreRole")
                return gitIgnoreRole
            }
        }

        log.debug("Parameter $name: No analysis strategy succeeded")
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
