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
    threadSafe = true
)
class NxBuildStateRecordMojo : AbstractMojo() {

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateRecordMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Parameter(property = "outputFile", defaultValue = "\${project.build.directory}/nx-build-state.json", readonly = true)
    private lateinit var outputFile: File

    @Throws(MojoExecutionException::class)
    override fun execute() {
        try {
            log.info("Recording build state for project: ${project.artifactId}")

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

            // Create build state
            val buildState = BuildState(
                compileSourceRoots = compileSourceRoots,
                testCompileSourceRoots = testCompileSourceRoots,
                mainArtifact = mainArtifact,
                attachedArtifacts = attachedArtifacts
            )

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
