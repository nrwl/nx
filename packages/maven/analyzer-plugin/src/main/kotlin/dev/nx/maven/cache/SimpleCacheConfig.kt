package dev.nx.maven.cache

/**
 * Simple data types for managing Maven plugin cache configuration.
 * These are custom data structures that replace build cache extension dependencies.
 */

data class CacheConfig(
    val globalIncludes: List<PathPattern> = emptyList(),
    val globalExcludes: List<PathPattern> = emptyList(),
    val plugins: Map<String, PluginConfig> = emptyMap(),
    val alwaysRunPlugins: Set<String> = emptySet()
)

data class PathPattern(
    val path: String,
    val glob: String? = null,
    val recursive: Boolean = false
)

data class PluginConfig(
    val artifactId: String,
    val inputParameters: Set<PathPattern> = emptySet(),
    val outputParameters: Set<PathPattern> = emptySet()
)
