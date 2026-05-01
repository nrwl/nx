package dev.nx.maven.shared

/**
 * Data class representing the build state of a Maven project.
 * Uses Gson for JSON serialization (no annotations needed for simple data classes).
 */
data class BuildState(
    val compileSourceRoots: Set<String>,
    val testCompileSourceRoots: Set<String>,
    val resources: Set<String> = emptySet(),
    val testResources: Set<String> = emptySet(),
    val outputDirectory: String? = null,
    val testOutputDirectory: String? = null,
    val compileClasspath: Set<String> = emptySet(),
    val testClasspath: Set<String> = emptySet(),
    val mainArtifact: ArtifactInfo?,
    val attachedArtifacts: List<ArtifactInfo>,
    val outputTimestamp: String? = null,
    val pomFile: String? = null
)

/**
 * Data class representing artifact information
 */
data class ArtifactInfo(
    val file: String,
    val type: String,
    val classifier: String?,
    val groupId: String,
    val artifactId: String,
    val version: String
)
