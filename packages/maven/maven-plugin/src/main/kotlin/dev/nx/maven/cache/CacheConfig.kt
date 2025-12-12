package dev.nx.maven.cache

data class PathPattern(
    val path: String,
    val recursive: Boolean = false
)

data class Parameter(val name: String, val glob: String?)

data class MojoConfig(
    val inputProperties: Set<String>? = null,
    val inputParameters: Set<Parameter>? = null,
    val outputParameters: Set<Parameter>? = null
)

/**
 * Simple data types for managing Maven plugin cache configuration.
 * These are custom data structures that replace build cache extension dependencies.
 */
data class CacheConfig(
    val defaultInputs: List<PathPattern> = emptyList(),
    val defaultOutputs: List<PathPattern> = emptyList(),
    val configurations: Map<String, MojoConfig> = emptyMap(),
    val nonCacheable: Set<String> = emptySet(),
    val continuous: Set<String> = emptySet()
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
                "maven-checkstyle-plugin:check" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("configLocation", null),
                        Parameter("headerLocation", null),
                        Parameter("propertiesLocation", null),
                        Parameter("rulesFiles", null),
                        Parameter("siteDirectory", null),
                        Parameter("sourceDirectories", null),
                        Parameter("suppressionsLocation", null),
                        Parameter("testSourceDirectories", null),
                    ),
                    outputParameters = setOf(
                        Parameter("cacheFile", null),
                        Parameter("outputDirectory", null),
                        Parameter("outputFile", null),
                    )
                ),
                "maven-checkstyle-plugin:checkstyle" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("configLocation", null),
                        Parameter("headerLocation", null),
                        Parameter("propertiesLocation", null),
                        Parameter("rulesFiles", null),
                        Parameter("siteDirectory", null),
                        Parameter("sourceDirectories", null),
                        Parameter("suppressionsLocation", null),
                        Parameter("testSourceDirectories", null),
                    ),
                    outputParameters = setOf(
                        Parameter("cacheFile", null),
                        Parameter("outputDirectory", null),
                        Parameter("outputFile", null),
                    )
                ),
                "maven-compiler-plugin:compile" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("compileSourceRoots", "**/*.java"),
                        // Include generated sources by convention
                        Parameter("buildDirectory", "generated-sources/**/*.java"),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "maven-compiler-plugin:testCompile" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("testCompileSourceRoots", "**/*.java"),
                    ),
                    inputProperties = setOf(
                        "project.build.outputDirectory",  // Main compiled classes that tests depend on
                        "project.build.testSourceDirectory",  // Test source files
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
                "maven-failsafe-plugin:integration-test" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("classesDirectory", null),
                        Parameter("testClassesDirectory", null),
                        Parameter("testSourceDirectory", null),
                        Parameter("suiteXmlFiles", null),
                    ),
                    outputParameters = setOf(
                        Parameter("summaryFile", null),
                    )
                ),
                "maven-failsafe-plugin:verify" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("summaryFile", null),
                        Parameter("summaryFiles", null),
                        Parameter("testClassesDirectory", null),
                    ),
                    outputParameters = emptySet()
                ),
                "maven-jar-plugin:jar" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("classesDirectory", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.jar"),
                    )
                ),
                "maven-jar-plugin:test-jar" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("testClassesDirectory", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.jar"),
                    )
                ),
                "maven-war-plugin:war" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("warSourceDirectory", null),
                        Parameter("webResources", null),
                        Parameter("webXml", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.war"),
                        Parameter("webappDirectory", null),
                        Parameter("workDirectory", null),
                    )
                ),
                "spring-boot-maven-plugin:run" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("testClassesDirectory", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.jar"),
                    )
                ),
                "spring-boot-maven-plugin:repackage" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("classesDirectory", null),
                        Parameter("testClassesDirectory", null),
                        Parameter("embeddedLaunchScript", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.jar"),
                    )
                ),
                "modello-maven-plugin:velocity" to MojoConfig(
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "modello-maven-plugin:xdoc" to MojoConfig(
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                ),
                "modello-maven-plugin:xsd" to MojoConfig(
                    outputParameters = setOf(
                        Parameter("outputDirectory", null),
                    )
                )
            ),
            nonCacheable = setOf(
                "maven-clean-plugin:clean",
                "maven-deploy-plugin:deploy",
                "maven-site-plugin:site",
                "maven-install-plugin:install",
                "bb-sdk-codegen:deploy-local",
                "spring-boot-maven-plugin:run"
            ),
            continuous = setOf(
                "spring-boot-maven-plugin:run",
            )
        )
    }
}

