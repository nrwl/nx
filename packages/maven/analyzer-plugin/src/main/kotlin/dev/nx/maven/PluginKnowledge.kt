package dev.nx.maven

import org.apache.maven.buildcache.xml.config.CacheConfig
import org.apache.maven.buildcache.xml.config.PluginConfigurationScan
import org.apache.maven.buildcache.xml.config.DirScanConfig
import org.apache.maven.buildcache.xml.config.TagScanConfig
import org.apache.maven.buildcache.xml.config.TagExclude
import org.apache.maven.buildcache.xml.config.io.xpp3.BuildCacheConfigXpp3Reader
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
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

data class ParameterInformation(
    val inputs: Set<String>,
    val outputs: Set<String>
)

class PluginKnowledge(private val expressionResolver: MavenExpressionResolver) {
    private val log = LoggerFactory.getLogger(PluginKnowledge::class.java)

    private val CACHE_CONFIG_RESOURCE = "/nx-cache-config.xml"

    private val cacheConfig: CacheConfig by lazy {
        loadCacheConfig()
    }

    /**
     * Gets the parameter role for a specific plugin and parameter combination.
     * Uses Maven build cache directory scanning rules to determine input/output classification.
     *
     * @param pluginArtifactId The plugin artifact ID (e.g., "maven-compiler-plugin")
     * @param parameterName The parameter name (e.g., "outputDirectory")
     * @return The ParameterRole if known, null otherwise
     */
    fun getParameterRole(pluginArtifactId: String, parameterName: String): ParameterRole {
        val plugin = getPluginConfig(pluginArtifactId) ?: return ParameterRole.NONE
        val dirScan = plugin.dirScan ?: return ParameterRole.NONE

        val role = when {
            isParameterInIncludes(dirScan, parameterName) -> ParameterRole.INPUT
            isParameterInExcludes(dirScan, parameterName) -> ParameterRole.OUTPUT
            else -> return ParameterRole.NONE
        }

        log.debug("Found parameter role from cache config: {}.{} -> {}", pluginArtifactId, parameterName, role)
        return   role
    }

    /**
     * Checks if a plugin is known in the cache configuration.
     */
    fun isKnownPlugin(pluginArtifactId: String?): Boolean {
        return pluginArtifactId?.let {
            getPluginConfig(it) != null
        } ?: false
    }

    /**
     * Checks if a specific execution is known for a plugin.
     * Note: Maven build cache extension doesn't use execution-level configuration,
     * so this always returns true if the plugin is known.
     */
    fun isKnownExecution(pluginArtifactId: String?, executionId: String?): Boolean {
        return isKnownPlugin(pluginArtifactId)
    }

    /**
     * Gets all known input tag scan configurations for a specific plugin.
     */
    fun getKnownInputTagScans(pluginArtifactId: String?): List<TagScanConfig> {
        if (pluginArtifactId == null) return emptyList()
        val plugin = getPluginConfig(pluginArtifactId) ?: return emptyList()
        return plugin.dirScan?.includes ?: emptyList()
    }

    /**
     * Gets all known output tag excludes for a specific plugin.
     */
    fun getKnownOutputTagExcludes(pluginArtifactId: String?): List<TagExclude> {
        if (pluginArtifactId == null) return emptyList()
        val plugin = getPluginConfig(pluginArtifactId) ?: return emptyList()
        return plugin.dirScan?.excludes ?: emptyList()
    }

    /**
     * Gets directory scan configuration for a specific plugin.
     */
    fun getDirScanConfig(pluginArtifactId: String?): DirScanConfig? {
        if (pluginArtifactId == null) return null
        return getPluginConfig(pluginArtifactId)?.dirScan
    }

    /**
     * Gets global input include patterns.
     */
    fun getGlobalIncludes(): List<org.apache.maven.buildcache.xml.config.Include> {
        return cacheConfig.input?.global?.includes ?: emptyList()
    }

    /**
     * Gets global input exclude patterns.
     */
    fun getGlobalExcludes(): List<org.apache.maven.buildcache.xml.config.Exclude> {
        return cacheConfig.input?.global?.excludes ?: emptyList()
    }

    /**
     * Checks if a plugin should always run (never be cached).
     */
    fun shouldAlwaysRun(pluginArtifactId: String?): Boolean {
        if (pluginArtifactId == null) return false
        return cacheConfig.executionControl?.runAlways?.plugins?.any {
            it.artifactId == pluginArtifactId
        } ?: false
    }


    /**
     * Gets output exclusion patterns.
     */
    fun getOutputExclusionPatterns(): List<String> {
        return cacheConfig.output?.exclude?.patterns ?: emptyList()
    }

    /**
     * Gets a specific plugin configuration.
     */
    private fun getPluginConfig(pluginArtifactId: String): PluginConfigurationScan? {
        return cacheConfig.input?.plugins?.find {
            it.artifactId == pluginArtifactId
        }
    }

    /**
     * Checks if a parameter is included in the directory scan includes.
     */
    private fun isParameterInIncludes(dirScan: DirScanConfig, parameterName: String): Boolean {
        return dirScan.includes?.any { include ->
            include.tagName == parameterName
        } ?: false
    }

    /**
     * Checks if a parameter is excluded in the directory scan excludes.
     */
    private fun isParameterInExcludes(dirScan: DirScanConfig, parameterName: String): Boolean {
        return dirScan.excludes?.any { exclude ->
            exclude.tagName == parameterName
        } ?: false
    }

    /**
     * Gets Maven's standard directory conventions as fallback inputs/outputs
     * Includes both Maven standard layout and global patterns from cache config
     */
    fun getMavenConventionFallbacks(): Pair<Set<String>, Set<String>> {
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        // Maven standard directory layout
        inputs.addAll(setOf(
            "src/main/java",
            "src/test/java",
            "src/main/resources",
            "src/test/resources",
            "pom.xml"
        ))

        outputs.addAll(setOf(
            "target/classes",
            "target/test-classes",
            "target"
        ))

        // Add global includes from cache config
        cacheConfig.input?.global?.includes?.forEach { include ->
            include.value?.let { directory ->
                // Include directories from global config as inputs
                when (directory) {
                    "." -> {
                        // Root directory includes (like pom.xml) are already covered above
                    }
                    else -> {
                        // Add any other directories specified in global includes
                        inputs.add(directory)
                    }
                }
            }
        }

        return Pair(inputs, outputs)
    }

    /**
     * Analyzes all parameters for a mojo execution to determine inputs and outputs
     */
    fun getParameterInformation(
        descriptor: MojoDescriptor,
        project: MavenProject,
        pathResolver: PathResolver
    ): List<ParameterInformation> {
        return descriptor.parameters?.parallelStream()?.map { parameter ->
            val paramInfo = analyzeParameterInputsOutputs(
                descriptor,
                parameter,
                project,
                pathResolver
            )
            log.debug("Parameter analysis: {} {} -> {}", descriptor.phase, parameter.name, paramInfo)
            paramInfo
        }?.collect(java.util.stream.Collectors.toList()) ?: emptyList()
    }

    /**
     * Analyzes a single parameter to determine inputs and outputs
     */
    private fun analyzeParameterInputsOutputs(
        descriptor: MojoDescriptor,
        parameter: Parameter,
        project: MavenProject,
        pathResolver: PathResolver
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
            ParameterRole.NONE -> {
                // Won't reach here due to early return above
            }
        }

        // Format all paths for Nx compatibility
        val formattedInputs = inputs.map { formatPathForNx(it) }.toSet()
        val formattedOutputs = outputs.map { formatPathForNx(it) }.toSet()

        return ParameterInformation(formattedInputs, formattedOutputs)
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

    private fun loadCacheConfig(): CacheConfig {
        return try {
            val resourceStream = javaClass.getResourceAsStream(CACHE_CONFIG_RESOURCE)
                ?: throw IllegalStateException("Could not find resource: $CACHE_CONFIG_RESOURCE")

            resourceStream.use { stream ->
                val reader = BuildCacheConfigXpp3Reader()
                val cacheConfig = reader.read(stream)
                log.info("Loaded cache configuration for ${cacheConfig.input?.plugins?.size ?: 0} plugins")
                cacheConfig
            }
        } catch (e: Exception) {
            log.warn("Failed to load cache configuration from $CACHE_CONFIG_RESOURCE: ${e.message}. Using empty configuration.")
            CacheConfig()
        }
    }
}
