package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.artifact.Artifact
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Maven plugin to record the current build state (source roots and artifacts)
 */
@Mojo(
    name = "record",
    requiresProject = true,
    threadSafe = false
)
class NxBuildStateRecordMojo : AbstractMojo() {

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateRecordMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Parameter(property = "outputFile", defaultValue = "\${project.build.directory}/nx-build-state.json", readonly = true)
    private lateinit var outputFile: File

    private fun readExistingState(): BuildState? {
        return try {
            if (outputFile.exists()) {
                log.info("Reading existing build state from: ${outputFile.absolutePath}")
                objectMapper.readValue(outputFile, BuildState::class.java)
            } else {
                log.info("No existing build state file found")
                null
            }
        } catch (e: Exception) {
            log.warn("Failed to read existing build state, starting fresh: ${e.message}")
            null
        }
    }

    private fun mergeArtifacts(existing: List<ArtifactInfo>, current: List<ArtifactInfo>): List<ArtifactInfo> {
        val artifactMap = mutableMapOf<String, ArtifactInfo>()

        // Add existing artifacts
        existing.forEach { artifact ->
            val key = "${artifact.type}:${artifact.classifier ?: ""}"
            artifactMap[key] = artifact
        }

        // Add/update with current artifacts (current takes precedence)
        current.forEach { artifact ->
            val key = "${artifact.type}:${artifact.classifier ?: ""}"
            artifactMap[key] = artifact
        }

        return artifactMap.values.toList()
    }

    private fun mergeStates(existing: BuildState?, current: BuildState): BuildState {
        if (existing == null) return current

        return BuildState(
            compileSourceRoots = existing.compileSourceRoots + current.compileSourceRoots,
            testCompileSourceRoots = existing.testCompileSourceRoots + current.testCompileSourceRoots,
            mainArtifact = current.mainArtifact ?: existing.mainArtifact,
            attachedArtifacts = mergeArtifacts(existing.attachedArtifacts, current.attachedArtifacts)
        )
    }

    @Throws(MojoExecutionException::class)
    override fun execute() {
        try {
            log.info("Recording build state for project: ${project.artifactId}")

            // Read existing state first
            val existingState = readExistingState()

            // Capture compile source roots
            val compileSourceRoots = project.compileSourceRoots.toSet()
            log.info("Captured ${compileSourceRoots.size} compile source roots")

            // Capture test compile source roots
            val testCompileSourceRoots = project.testCompileSourceRoots.toSet()
            log.info("Captured ${testCompileSourceRoots.size} test compile source roots")

            // Capture main artifact
            val mainArtifact = if (project.artifact?.file != null) {
                ArtifactInfo(
                    file = project.artifact.file.absolutePath,
                    type = project.artifact.type,
                    classifier = project.artifact.classifier,
                    groupId = project.artifact.groupId,
                    artifactId = project.artifact.artifactId,
                    version = project.artifact.version
                )
            } else null

            if (mainArtifact != null) {
                log.info("Captured main artifact: ${mainArtifact.file}")
            }

            // Capture attached artifacts
            val attachedArtifacts = project.attachedArtifacts.map { artifact: Artifact ->
                ArtifactInfo(
                    file = artifact.file?.absolutePath ?: "",
                    type = artifact.type,
                    classifier = artifact.classifier,
                    groupId = artifact.groupId,
                    artifactId = artifact.artifactId,
                    version = artifact.version
                )
            }

            log.info("Captured ${attachedArtifacts.size} attached artifacts")

            // Create current build state
            val currentState = BuildState(
                compileSourceRoots = compileSourceRoots,
                testCompileSourceRoots = testCompileSourceRoots,
                mainArtifact = mainArtifact,
                attachedArtifacts = attachedArtifacts
            )

            // Merge with existing state
            val buildState = mergeStates(existingState, currentState)

            log.info("Merged build state - Total compile source roots: ${buildState.compileSourceRoots.size}, " +
                    "Total test source roots: ${buildState.testCompileSourceRoots.size}, " +
                    "Total attached artifacts: ${buildState.attachedArtifacts.size}")

            // Ensure output directory exists
            outputFile.parentFile?.mkdirs()

            // Write to JSON file
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputFile, buildState)
            log.info("Build state recorded to: ${outputFile.absolutePath}")

        } catch (e: Exception) {
            throw MojoExecutionException("Failed to record build state", e)
        }
    }
}
