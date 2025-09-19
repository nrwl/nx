package dev.nx.maven

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * Data class representing the build state of a Maven project
 */
data class BuildState @JsonCreator constructor(
    @JsonProperty("compileSourceRoots") val compileSourceRoots: Set<String>,
    @JsonProperty("testCompileSourceRoots") val testCompileSourceRoots: Set<String>,
    @JsonProperty("resources") val resources: Set<String> = emptySet(),
    @JsonProperty("testResources") val testResources: Set<String> = emptySet(),
    @JsonProperty("outputDirectory") val outputDirectory: String? = null,
    @JsonProperty("testOutputDirectory") val testOutputDirectory: String? = null,
    @JsonProperty("compileClasspath") val compileClasspath: Set<String> = emptySet(),
    @JsonProperty("testClasspath") val testClasspath: Set<String> = emptySet(),
    @JsonProperty("mainArtifact") val mainArtifact: ArtifactInfo?,
    @JsonProperty("attachedArtifacts") val attachedArtifacts: List<ArtifactInfo>
)

/**
 * Data class representing artifact information
 */
data class ArtifactInfo @JsonCreator constructor(
    @JsonProperty("file") val file: String,
    @JsonProperty("type") val type: String,
    @JsonProperty("classifier") val classifier: String?,
    @JsonProperty("groupId") val groupId: String,
    @JsonProperty("artifactId") val artifactId: String,
    @JsonProperty("version") val version: String
)
