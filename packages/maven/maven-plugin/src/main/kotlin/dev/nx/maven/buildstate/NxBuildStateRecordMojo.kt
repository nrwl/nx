package dev.nx.maven.buildstate

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.artifact.Artifact
import org.apache.maven.model.Resource
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

    companion object {
        private const val BUILD_STATE_FILE = "nx-build-state.json"
    }

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateRecordMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Parameter(property = "outputFile", defaultValue = "\${project.build.directory}/$BUILD_STATE_FILE", readonly = true)
    private lateinit var outputFile: File

    @Throws(MojoExecutionException::class)
    override fun execute() {
        val startTime = System.currentTimeMillis()
        try {
            log.info("Recording build state for project: ${project.artifactId}")

            // Capture compile source roots
            val compileSourceRootsAbsolute = project.compileSourceRoots.toSet()
            val compileSourceRoots = PathUtils.toRelativePaths(compileSourceRootsAbsolute, project.basedir, log)
            log.info("Captured ${compileSourceRoots.size} compile source roots")

            // Capture test compile source roots
            val testCompileSourceRootsAbsolute = project.testCompileSourceRoots.toSet()
            val testCompileSourceRoots = PathUtils.toRelativePaths(testCompileSourceRootsAbsolute, project.basedir, log)
            log.info("Captured ${testCompileSourceRoots.size} test compile source roots")

            // Capture resources
            val resourcesAbsolute = project.resources.map { (it as Resource).directory }.filter { it != null }.toSet()
            val resources = PathUtils.toRelativePaths(resourcesAbsolute, project.basedir, log)
            log.info("Captured ${resources.size} resource directories")

            // Capture test resources
            val testResourcesAbsolute = project.testResources.map { (it as Resource).directory }.filter { it != null }.toSet()
            val testResources = PathUtils.toRelativePaths(testResourcesAbsolute, project.basedir, log)
            log.info("Captured ${testResources.size} test resource directories")

            // Capture output directories and convert to relative paths
            val outputDirectoryAbsolute = project.build.outputDirectory
            val outputDirectory = PathUtils.toRelativePath(outputDirectoryAbsolute, project.basedir, log)
            val testOutputDirectoryAbsolute = project.build.testOutputDirectory
            val testOutputDirectory = PathUtils.toRelativePath(testOutputDirectoryAbsolute, project.basedir, log)
            log.info("Captured output directory: $outputDirectory")
            log.info("Captured test output directory: $testOutputDirectory")

            // Capture compile classpath and convert to relative paths
            val compileClasspath = captureClasspath("compile", project.compileClasspathElements)

            // Capture test classpath and convert to relative paths
            val testClasspath = captureClasspath("test", project.testClasspathElements)

            // Capture main artifact (only if file exists)
            val mainArtifact = captureMainArtifact()

            // Capture attached artifacts (only if file exists)
            val attachedArtifacts = captureAttachedArtifacts()

            // Capture project.build.outputTimestamp for reproducible builds
            val outputTimestamp = project.properties.getProperty("project.build.outputTimestamp")
            if (outputTimestamp != null) {
                log.info("Captured outputTimestamp: $outputTimestamp")
            }

            // Create build state
            val buildState = BuildState(
                compileSourceRoots = compileSourceRoots,
                testCompileSourceRoots = testCompileSourceRoots,
                resources = resources,
                testResources = testResources,
                outputDirectory = outputDirectory,
                testOutputDirectory = testOutputDirectory,
                compileClasspath = compileClasspath,
                testClasspath = testClasspath,
                mainArtifact = mainArtifact,
                attachedArtifacts = attachedArtifacts,
                outputTimestamp = outputTimestamp
            )

            log.info("Recorded build state - Compile source roots: ${buildState.compileSourceRoots.size}, " +
                    "Test source roots: ${buildState.testCompileSourceRoots.size}, " +
                    "Resources: ${buildState.resources.size}, " +
                    "Test resources: ${buildState.testResources.size}, " +
                    "Output directory: ${buildState.outputDirectory}, " +
                    "Test output directory: ${buildState.testOutputDirectory}, " +
                    "Compile classpath: ${buildState.compileClasspath.size}, " +
                    "Test classpath: ${buildState.testClasspath.size}, " +
                    "Attached artifacts: ${buildState.attachedArtifacts.size}")

            // Ensure output directory exists
            outputFile.parentFile?.mkdirs()

            // Write to JSON file
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputFile, buildState)

            val duration = System.currentTimeMillis() - startTime
            log.info("Build state recorded to: ${outputFile.absolutePath} (took ${duration}ms)")

        } catch (e: Exception) {
            throw MojoExecutionException("Failed to record build state", e)
        }
    }

    private fun captureClasspath(classpathType: String, classpathElements: List<String>): Set<String> {
        val absolutePaths = try {
            classpathElements.toSet()
        } catch (e: Exception) {
            log.warn("Failed to capture $classpathType classpath: ${e.message}")
            emptySet<String>()
        }
        val relativePaths = PathUtils.toRelativePaths(absolutePaths, project.basedir, log)
        log.info("Captured ${relativePaths.size} $classpathType classpath elements")
        return relativePaths
    }

    private fun captureMainArtifact(): ArtifactInfo? {
        val artifactFile = project.artifact?.file
        if (artifactFile != null && artifactFile.exists()) {
            val info = ArtifactInfo(
                file = PathUtils.toRelativePath(artifactFile.absolutePath, project.basedir, log),
                type = project.artifact.type,
                classifier = project.artifact.classifier,
                groupId = project.artifact.groupId,
                artifactId = project.artifact.artifactId,
                version = project.artifact.version
            )
            log.info("Captured main artifact: ${info.file}")
            return info
        } else if (artifactFile != null) {
            log.warn("Main artifact file does not exist: ${artifactFile.absolutePath}")
        }
        return null
    }

    private fun captureAttachedArtifacts(): List<ArtifactInfo> {
        val artifacts = project.attachedArtifacts.mapNotNull { artifact: Artifact ->
            when {
                artifact.file != null && artifact.file.exists() -> ArtifactInfo(
                    file = PathUtils.toRelativePath(artifact.file.absolutePath, project.basedir, log),
                    type = artifact.type,
                    classifier = artifact.classifier,
                    groupId = artifact.groupId,
                    artifactId = artifact.artifactId,
                    version = artifact.version
                )
                artifact.file == null -> {
                    log.warn("Attached artifact has no file: ${artifact.groupId}:${artifact.artifactId}:${artifact.version}")
                    null
                }
                else -> {
                    log.warn("Attached artifact file does not exist: ${artifact.file.absolutePath}")
                    null
                }
            }
        }
        log.info("Captured ${artifacts.size} attached artifacts")
        return artifacts
    }
}
