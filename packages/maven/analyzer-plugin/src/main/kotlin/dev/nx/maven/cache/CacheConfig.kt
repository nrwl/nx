package dev.nx.maven.cache

data class PathPattern(
    val path: String,
    val recursive: Boolean = false
)

data class Parameter(val name: String, val glob: String?)

data class MojoConfig(
    val inputProperties: Set<String> = emptySet(),
    val inputParameters: Set<Parameter> = emptySet(),
    val outputParameters: Set<Parameter> = emptySet()
)

/**
 * Simple data types for managing Maven plugin cache configuration.
 * These are custom data structures that replace build cache extension dependencies.
 */
data class CacheConfig(
    val defaultInputs: List<PathPattern> = emptyList(),
    val defaultOutputs: List<PathPattern> = emptyList(),
    val configurations: Map<String, MojoConfig> = emptyMap(),
    val nonCacheable: Set<String> = emptySet()
) {
    companion object {
        val DEFAULT = CacheConfig(
            defaultInputs = listOf(
                PathPattern("src/main/**/*", recursive = true),
                PathPattern("src/test/**/*", recursive = true),
                PathPattern("pom.xml"),
                PathPattern("*.properties")
            ),
            defaultOutputs = listOf(
                PathPattern("target")
            ),
            configurations = mapOf(
                "maven-compiler-plugin:compile" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("compileSourceRoots", "**/*.java"),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "maven-compiler-plugin:testCompile" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("compileSourceRoots", "**/*.java"),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "maven-resources-plugin:resources" to MojoConfig(
                    inputProperties = setOf("project.build.resources"),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "maven-resources-plugin:testResources" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("resources", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "maven-surefire-plugin:test" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("classesDirectory", null),
                        Parameter("testClassesDirectory", null),
                        Parameter("suiteXmlFiles", null),
                    ),
                    outputParameters = setOf(
                        Parameter("reportsDirectory", null),
                    )
                ),
                "maven-surefire-plugin:test" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("classesDirectory", null),
                        Parameter("testClassesDirectory", null),
                        Parameter("suiteXmlFiles", null),
                    ),
                    outputParameters = setOf(
                        Parameter("reportsDirectory", null),
                    )
                )
            ),
            nonCacheable = setOf(
                "maven-clean-plugin:clean",
                "maven-deploy-plugin:deploy",
                "maven-install-plugin:install"
            )
        )
    }
}

