package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Maven plugin to reapply previously recorded build state (source roots and artifacts)
 */
@Mojo(
    name = "apply",
    requiresProject = true,
    threadSafe = true
)
class NxBuildStateApplyMojo : AbstractMojo() {

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateApplyMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var projectHelper: MavenProjectHelper

    @Parameter(property = "inputFile", defaultValue = "\${project.build.directory}/nx-build-state.json")
    private lateinit var inputFile: File

    @Parameter(property = "skipIfMissing", defaultValue = "true")
    private var skipIfMissing: Boolean = true

    @Throws(MojoExecutionException::class)
    override fun execute() {
        try {
            if (!inputFile.exists()) {
                if (skipIfMissing) {
                    log.info("Build state file not found, skipping: ${inputFile.absolutePath}")
                    return
                } else {
                    throw MojoExecutionException("Build state file not found: ${inputFile.absolutePath}")
                }
            }

            log.info("Reapplying build state for project: ${project.artifactId}")
            log.info("Reading build state from: ${inputFile.absolutePath}")

            // Read build state from JSON
            val buildState = objectMapper.readValue(inputFile, BuildState::class.java)

            // Reapply compile source roots
            buildState.compileSourceRoots.forEach { sourceRoot ->
                val sourceDir = File(sourceRoot)
                if (sourceDir.exists() && sourceDir.isDirectory) {
                    project.addCompileSourceRoot(sourceRoot)
                    log.info("Added compile source root: $sourceRoot")
                } else {
                    log.warn("Compile source root does not exist or is not a directory: $sourceRoot")
                }
            }

            // Reapply test compile source roots
            buildState.testCompileSourceRoots.forEach { testSourceRoot ->
                val testSourceDir = File(testSourceRoot)
                if (testSourceDir.exists() && testSourceDir.isDirectory) {
                    project.addTestCompileSourceRoot(testSourceRoot)
                    log.info("Added test compile source root: $testSourceRoot")
                } else {
                    log.warn("Test compile source root does not exist or is not a directory: $testSourceRoot")
                }
            }

            // Reapply main artifact
            buildState.mainArtifact?.let { artifactInfo ->
                val artifactFile = File(artifactInfo.file)
                if (artifactFile.exists() && artifactFile.isFile) {
                    project.artifact.file = artifactFile
                    log.info("Set main artifact: ${artifactFile.absolutePath}")
                } else {
                    log.warn("Main artifact file does not exist: ${artifactInfo.file}")
                }
            }

            // Reapply attached artifacts
            buildState.attachedArtifacts.forEach { artifactInfo ->
                val artifactFile = File(artifactInfo.file)
                if (artifactFile.exists() && artifactFile.isFile) {
                    if (artifactInfo.classifier != null && artifactInfo.classifier.isNotEmpty()) {
                        projectHelper.attachArtifact(project, artifactInfo.type, artifactInfo.classifier, artifactFile)
                        log.info("Attached artifact with classifier '${artifactInfo.classifier}': ${artifactFile.absolutePath}")
                    } else {
                        projectHelper.attachArtifact(project, artifactInfo.type, artifactFile)
                        log.info("Attached artifact: ${artifactFile.absolutePath}")
                    }
                } else {
                    log.warn("Attached artifact file does not exist: ${artifactInfo.file}")
                }
            }

            log.info("Successfully reapplied build state for project: ${project.artifactId}")

        } catch (e: Exception) {
            throw MojoExecutionException("Failed to reapply build state", e)
        }
    }
}
