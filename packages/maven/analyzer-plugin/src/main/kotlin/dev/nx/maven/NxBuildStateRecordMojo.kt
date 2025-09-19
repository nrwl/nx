package dev.nx.maven

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

            // Capture resources
            val resources = project.resources.map { (it as Resource).directory }.filter { it != null }.toSet()
            log.info("Captured ${resources.size} resource directories")

            // Capture test resources
            val testResources = project.testResources.map { (it as Resource).directory }.filter { it != null }.toSet()
            log.info("Captured ${testResources.size} test resource directories")

            // Capture generated source roots (from build helper plugin or annotation processors)
            val generatedSourceRoots = mutableSetOf<String>()
            val generatedTestSourceRoots = mutableSetOf<String>()

            // Look for common generated source patterns
            val targetGenerated = File(project.build.directory, "generated-sources")
            if (targetGenerated.exists()) {
                targetGenerated.listFiles()?.forEach { dir ->
                    if (dir.isDirectory) {
                        generatedSourceRoots.add(dir.absolutePath)
                    }
                }
            }

            val targetGeneratedTest = File(project.build.directory, "generated-test-sources")
            if (targetGeneratedTest.exists()) {
                targetGeneratedTest.listFiles()?.forEach { dir ->
                    if (dir.isDirectory) {
                        generatedTestSourceRoots.add(dir.absolutePath)
                    }
                }
            }

            log.info("Captured ${generatedSourceRoots.size} generated source roots")
            log.info("Captured ${generatedTestSourceRoots.size} generated test source roots")

            // Capture output directories
            val outputDirectory = project.build.outputDirectory
            val testOutputDirectory = project.build.testOutputDirectory
            log.info("Captured output directory: $outputDirectory")
            log.info("Captured test output directory: $testOutputDirectory")

            // Capture compile classpath
            val compileClasspath = try {
                project.compileClasspathElements.toSet()
            } catch (e: Exception) {
                log.warn("Failed to capture compile classpath: ${e.message}")
                emptySet<String>()
            }
            log.info("Captured ${compileClasspath.size} compile classpath elements")

            // Capture test classpath
            val testClasspath = try {
                project.testClasspathElements.toSet()
            } catch (e: Exception) {
                log.warn("Failed to capture test classpath: ${e.message}")
                emptySet<String>()
            }
            log.info("Captured ${testClasspath.size} test classpath elements")

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
                resources = resources,
                testResources = testResources,
                generatedSourceRoots = generatedSourceRoots,
                generatedTestSourceRoots = generatedTestSourceRoots,
                outputDirectory = outputDirectory,
                testOutputDirectory = testOutputDirectory,
                compileClasspath = compileClasspath,
                testClasspath = testClasspath,
                mainArtifact = mainArtifact,
                attachedArtifacts = attachedArtifacts
            )

            // Don't merge - just use current state to avoid duplicates
            val buildState = currentState

            log.info("Recorded build state - Compile source roots: ${buildState.compileSourceRoots.size}, " +
                    "Test source roots: ${buildState.testCompileSourceRoots.size}, " +
                    "Resources: ${buildState.resources.size}, " +
                    "Test resources: ${buildState.testResources.size}, " +
                    "Generated source roots: ${buildState.generatedSourceRoots.size}, " +
                    "Generated test source roots: ${buildState.generatedTestSourceRoots.size}, " +
                    "Output directory: ${buildState.outputDirectory}, " +
                    "Test output directory: ${buildState.testOutputDirectory}, " +
                    "Compile classpath: ${buildState.compileClasspath.size}, " +
                    "Test classpath: ${buildState.testClasspath.size}, " +
                    "Attached artifacts: ${buildState.attachedArtifacts.size}")

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
