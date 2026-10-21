package dev.nx.maven.cache

data class PathPattern(
    val path: String,
    val recursive: Boolean = false
)

data class Parameter(val name: String, val glob: String?, val excludeGlob: String? = null)

// A path from the project model (e.g. project.build.outputDirectory) rather than a mojo parameter.
data class Property(val name: String, val glob: String? = null, val excludeGlob: String? = null)

data class MojoConfig(
    val inputProperties: Set<Property>? = null,
    val inputParameters: Set<Parameter>? = null,
    val outputParameters: Set<Parameter>? = null,
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
                        // javac writes annotations/ itself, so hashing it would miss on the next run.
                        Parameter(
                            "buildDirectory",
                            "generated-sources/**/*.java",
                            excludeGlob = "generated-sources/annotations/**",
                        ),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "**/*.class"),
                    )
                ),
                "maven-compiler-plugin:testCompile" to MojoConfig(
                    inputProperties = setOf(
                        Property("project.build.outputDirectory"),
                    ),
                    inputParameters = setOf(
                        Parameter("compileSourceRoots", "**/*.java"),
                        Parameter(
                            "buildDirectory",
                            "generated-test-sources/**/*.java",
                            excludeGlob = "generated-test-sources/test-annotations/**",
                        ),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "**/*.class"),
                    )
                ),
                "maven-resources-plugin:resources" to MojoConfig(
                    inputProperties = setOf(Property("project.build.resources")),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null, excludeGlob = "**/*.class"),
                    )
                ),
                "maven-resources-plugin:testResources" to MojoConfig(
                    inputParameters = setOf(
                        Parameter("resources", null),
                    ),
                    outputParameters = setOf(
                        Parameter("outputDirectory", null, excludeGlob = "**/*.class"),
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
                // A pom-configured outputFile isn't resolved; outputDirectory/*.jar covers the default location.
                "maven-shade-plugin:shade" to MojoConfig(
                    // Its jar comes from maven-jar-plugin in the same package task, so classesDirectory covers it.
                    inputParameters = emptySet(),
                    outputParameters = setOf(
                        Parameter("outputDirectory", "*.jar"),
                        Parameter("dependencyReducedPomLocation", null),
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
                // Both publish the pom, the main artifact and the attached artifacts.
                "maven-install-plugin:install" to MojoConfig(
                    inputProperties = setOf(Property("project.artifact.file"), Property("project.attachedArtifacts")),
                ),
                "maven-deploy-plugin:deploy" to MojoConfig(
                    inputProperties = setOf(Property("project.artifact.file"), Property("project.attachedArtifacts")),
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

