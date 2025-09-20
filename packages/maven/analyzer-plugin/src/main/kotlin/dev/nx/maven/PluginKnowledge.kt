package dev.nx.maven

import org.apache.maven.buildcache.xml.config.CacheConfig
import org.apache.maven.buildcache.xml.config.PluginConfigurationScan
import org.apache.maven.buildcache.xml.config.DirScanConfig
import org.apache.maven.buildcache.xml.config.TagScanConfig
import org.apache.maven.buildcache.xml.config.TagExclude
import org.apache.maven.buildcache.xml.config.io.xpp3.BuildCacheConfigXpp3Reader
import org.slf4j.LoggerFactory

/**
 * Provides knowledge about Maven plugin directory scanning and input/output classification.
 * Uses Maven build cache extension's official configuration format for compatibility.
 */
class PluginKnowledge {
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
     * @param executionId The execution ID (not used in this approach, kept for API compatibility)
     * @param parameterName The parameter name (e.g., "outputDirectory")
     * @return The ParameterRole if known, null otherwise
     */
    fun getParameterRole(pluginArtifactId: String?, executionId: String?, parameterName: String?): ParameterRole? {
        if (pluginArtifactId == null || parameterName == null) {
            return null
        }

        return try {
            val plugin = getPluginConfig(pluginArtifactId) ?: return null
            val dirScan = plugin.dirScan ?: return null

            val role = when {
                isParameterInIncludes(dirScan, parameterName) -> ParameterRole.INPUT
                isParameterInExcludes(dirScan, parameterName) -> ParameterRole.OUTPUT
                else -> return null
            }

            log.debug("Found parameter role from cache config: $pluginArtifactId.$parameterName -> $role")
            role
        } catch (e: Exception) {
            log.warn("Error looking up parameter role for $pluginArtifactId.$parameterName: ${e.message}")
            null
        }
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
