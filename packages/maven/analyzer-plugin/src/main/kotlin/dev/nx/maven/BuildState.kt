package dev.nx.maven

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * Data class representing the build state of a Maven project
 */
data class BuildState @JsonCreator constructor(
    @JsonProperty("compileSourceRoots") val compileSourceRoots: Set<String>,
    @JsonProperty("testCompileSourceRoots") val testCompileSourceRoots: Set<String>,
    @JsonProperty("resources") val resources: Set<String>,
    @JsonProperty("testResources") val testResources: Set<String>,
    @JsonProperty("generatedSourceRoots") val generatedSourceRoots: Set<String>,
    @JsonProperty("generatedTestSourceRoots") val generatedTestSourceRoots: Set<String>,
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