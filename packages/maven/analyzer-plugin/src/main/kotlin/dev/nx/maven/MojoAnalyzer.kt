package dev.nx.maven

import dev.nx.maven.cache.CacheConfig
import dev.nx.maven.cache.CacheConfigLoader
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.slf4j.LoggerFactory

/**
 * Provides knowledge about Maven plugin directory scanning and input/output classification.
 * Uses Maven build cache extension's official configuration format for compatibility.
 */
enum class ParameterRole {
    INPUT,      // Parameter represents input files/data
    OUTPUT,     // Parameter represents output files/data
    BOTH,       // Parameter can be both input and output
    NONE     // Unable to determine parameter role
}

data class MojoAnalysis(
    val inputs: Set<String>,
    val outputs: Set<String>,
    val isCacheable: Boolean,
    val isThreadSafe: Boolean,
    val usedFallback: Boolean
)

private data class ParameterInformation(
    val inputs: Set<String>,
    val outputs: Set<String>
)

class MojoAnalyzer(
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver
) {
    private val log = LoggerFactory.getLogger(MojoAnalyzer::class.java)

    private val cacheConfig: CacheConfig by lazy {
        CacheConfigLoader().loadConfig("/nx-cache-config.xml")
    }

    /**
     * Aggregates cacheability, thread-safety, and input/output metadata for a mojo.
     */
    fun analyzeMojo(
        pluginDescriptor: PluginDescriptor,
        goal: String,
        project: MavenProject
    ): MojoAnalysis? {
        val descriptor = pluginDescriptor.getMojo(goal)
            ?: run {
                log.warn(
                    "Skipping analysis for ${pluginDescriptor.artifactId}:$goal – mojo descriptor not found"
                )
                return null
            }

        val parameterInfos = collectParameterInformation(descriptor, project)

        val aggregatedInputs = mutableSetOf<String>()
        val aggregatedOutputs = mutableSetOf<String>()

        parameterInfos.forEach { info ->
            aggregatedInputs.addAll(info.inputs)
            aggregatedOutputs.addAll(info.outputs)
        }

        var usedFallback = false

        if (aggregatedInputs.isEmpty()) {
            aggregatedInputs.addAll(mavenFallbackInputs)
            usedFallback = true
        }

        if (aggregatedOutputs.isEmpty()) {
            aggregatedOutputs.addAll(mavenFallbackOutputs)
            usedFallback = true
        }

        cacheConfig.globalIncludes.forEach { include ->
            var path = include.path
            include.glob?.let { glob -> path += "/$glob" }

            val formatted = formatPathForNx(path)
            aggregatedInputs.add(formatted)
            log.debug("Added global include input path: $formatted")

            // TODO: This is not supported by nx yet
//            if (include.recursive) {
//                aggregatedInputs.add("^$formatted")
//            }
        }

        cacheConfig.globalExcludes.forEach { exclude ->
            var path = exclude.path
            exclude.glob?.let { glob -> path += "/$glob" }

            val formatted = formatPathForNx(path)
            aggregatedInputs.add("!$formatted")
            log.debug("Added global exclude input path: !$formatted")
        }

        val cacheable = isMojoCacheable(descriptor)

        return MojoAnalysis(
            inputs = aggregatedInputs.toSet(),
            outputs = aggregatedOutputs.toSet(),
            isCacheable = cacheable,
            isThreadSafe = descriptor.isThreadSafe,
            usedFallback = usedFallback
        )
    }

    /**
     * Analyzes a single parameter to determine inputs and outputs
     */
    private fun analyzeParameterInputsOutputs(
        descriptor: MojoDescriptor,
        parameter: Parameter,
        project: MavenProject
    ): ParameterInformation {
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val role = getParameterRole(descriptor.pluginDescriptor.artifactId, parameter.name)

        if (role == ParameterRole.NONE) {
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

            else -> {}
        }

        // Format all paths for Nx compatibility
        val formattedInputs = inputs.map { formatPathForNx(it) }.toSet()
        val formattedOutputs = outputs.map { formatPathForNx(it) }.toSet()

        return ParameterInformation(formattedInputs, formattedOutputs)
    }

    private fun collectParameterInformation(
        descriptor: MojoDescriptor,
        project: MavenProject
    ): List<ParameterInformation> {
        return descriptor.parameters?.parallelStream()?.map { parameter ->
            val paramInfo = analyzeParameterInputsOutputs(
                descriptor,
                parameter,
                project
            )
            log.debug("Parameter analysis: {} {} -> {}", descriptor.phase, parameter.name, paramInfo)
            paramInfo
        }?.collect(java.util.stream.Collectors.toList()) ?: emptyList()
    }

    /**
     * Formats a path for Nx compatibility by adding {projectRoot} prefix for relative paths
     */
    private fun formatPathForNx(path: String): String {
        return when {
            // Already has Nx interpolation
            path.startsWith("{") -> path
            // Absolute paths stay as-is (though not recommended for Nx)
            path.startsWith("/") -> path
            // Relative paths get {projectRoot} prefix
            else -> "{projectRoot}/$path"
        }
    }

    /**
     * Gets the parameter role for a specific plugin and parameter combination.
     * Uses Maven build cache directory scanning rules to determine input/output classification.
     *
     * @param pluginArtifactId The plugin artifact ID (e.g., "maven-compiler-plugin")
     * @param parameterName The parameter name (e.g., "outputDirectory")
     * @return The ParameterRole if known, null otherwise
     */
    private fun getParameterRole(pluginArtifactId: String, parameterName: String): ParameterRole {
        val plugin = cacheConfig.plugins[pluginArtifactId] ?: return ParameterRole.NONE

        val role = when {
            plugin.inputParameters.contains(parameterName) -> ParameterRole.INPUT
            plugin.outputParameters.contains(parameterName) -> ParameterRole.OUTPUT
            else -> return ParameterRole.NONE
        }

        log.debug("Found parameter role from cache config: {}.{} -> {}", pluginArtifactId, parameterName, role)
        return role
    }

    /**
     * Checks if a plugin should always run (never be cached).
     */
    private fun shouldAlwaysRun(pluginArtifactId: String?): Boolean {
        if (pluginArtifactId == null) return false
        return cacheConfig.alwaysRunPlugins.contains(pluginArtifactId)
    }


    private fun isMojoCacheable(descriptor: MojoDescriptor): Boolean {
        val artifactId = descriptor.pluginDescriptor?.artifactId

        if (shouldAlwaysRun(artifactId)) {
            log.debug("Plugin $artifactId should always run - not cacheable")
            return false
        }

        log.debug("Plugin $artifactId:${descriptor.goal} is cacheable by default")
        return true
    }

    internal val mavenFallbackInputs: Set<String> by lazy {
        val inputs = mutableSetOf(
            "src/main/java",
            "src/test/java",
            "src/main/resources",
            "src/test/resources",
            "pom.xml"
        )

        cacheConfig.globalIncludes.forEach { include ->
            when (include.path) {
                "." -> {
                    // Root directory includes (like pom.xml) are already covered above
                }
                else -> inputs.add(include.path)
            }
        }

        inputs.map { formatPathForNx(it) }.toSet()
    }

    internal val mavenFallbackOutputs: Set<String> by lazy {
        val outputs = mutableSetOf(
            "target/classes",
            "target/test-classes",
            "target"
        )

        outputs.map { formatPathForNx(it) }.toSet()
    }

}
