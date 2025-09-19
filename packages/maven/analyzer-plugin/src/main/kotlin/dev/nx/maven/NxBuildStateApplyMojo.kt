package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.model.Resource
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
    threadSafe = false
)
class NxBuildStateApplyMojo : AbstractMojo() {

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateApplyMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var projectHelper: MavenProjectHelper

    @Parameter(property = "inputFile", defaultValue = "\${project.build.directory}/nx-build-state.json", readonly = true)
    private lateinit var inputFile: File

    @Throws(MojoExecutionException::class)
    override fun execute() {
        try {
            if (!inputFile.exists()) {
                log.info("Build state file not found, skipping: ${inputFile.absolutePath}")
                return
            }

            log.info("Reapplying build state for project: ${project.artifactId}")
            log.info("Reading build state from: ${inputFile.absolutePath}")

            // Read build state from JSON
            val buildState = try {
                objectMapper.readValue(inputFile, BuildState::class.java)
            } catch (e: Exception) {
                log.warn("Failed to read build state file: ${e.message}")
                log.info("Skipping build state application due to corrupted or empty file")
                return
            }

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

            // Reapply resources
            buildState.resources.forEach { resourceDir ->
                val resourceDirectory = File(resourceDir)
                if (resourceDirectory.exists() && resourceDirectory.isDirectory) {
                    val resource = Resource()
                    resource.directory = resourceDir
                    project.addResource(resource)
                    log.info("Added resource directory: $resourceDir")
                } else {
                    log.warn("Resource directory does not exist or is not a directory: $resourceDir")
                }
            }

            // Reapply test resources
            buildState.testResources.forEach { testResourceDir ->
                val testResourceDirectory = File(testResourceDir)
                if (testResourceDirectory.exists() && testResourceDirectory.isDirectory) {
                    val testResource = Resource()
                    testResource.directory = testResourceDir
                    project.addTestResource(testResource)
                    log.info("Added test resource directory: $testResourceDir")
                } else {
                    log.warn("Test resource directory does not exist or is not a directory: $testResourceDir")
                }
            }

//            // Reapply generated source roots
//            buildState.generatedSourceRoots.forEach { generatedSourceRoot ->
//                val generatedSourceDir = File(generatedSourceRoot)
//                if (generatedSourceDir.exists() && generatedSourceDir.isDirectory) {
//                    project.addCompileSourceRoot(generatedSourceRoot)
//                    log.info("Added generated source root: $generatedSourceRoot")
//                } else {
//                    log.warn("Generated source root does not exist or is not a directory: $generatedSourceRoot")
//                }
//            }
//
//            // Reapply generated test source roots
//            buildState.generatedTestSourceRoots.forEach { generatedTestSourceRoot ->
//                val generatedTestSourceDir = File(generatedTestSourceRoot)
//                if (generatedTestSourceDir.exists() && generatedTestSourceDir.isDirectory) {
//                    project.addTestCompileSourceRoot(generatedTestSourceRoot)
//                    log.info("Added generated test source root: $generatedTestSourceRoot")
//                } else {
//                    log.warn("Generated test source root does not exist or is not a directory: $generatedTestSourceRoot")
//                }
//            }

            // Reapply output directories
            buildState.outputDirectory?.let { outputDir ->
                val outputDirectory = File(outputDir)
                if (outputDirectory.exists() && outputDirectory.isDirectory) {
                    project.build.outputDirectory = outputDir
                    log.info("Set output directory: $outputDir")
                } else {
                    log.warn("Output directory does not exist or is not a directory: $outputDir")
                }
            }

            buildState.testOutputDirectory?.let { testOutputDir ->
                val testOutputDirectory = File(testOutputDir)
                if (testOutputDirectory.exists() && testOutputDirectory.isDirectory) {
                    project.build.testOutputDirectory = testOutputDir
                    log.info("Set test output directory: $testOutputDir")
                } else {
                    log.warn("Test output directory does not exist or is not a directory: $testOutputDir")
                }
            }

            // Note: Classpaths are typically rebuilt from dependencies, so we don't restore them
            // They are captured for informational purposes and dependency analysis
            if (buildState.compileClasspath.isNotEmpty()) {
                log.info("Recorded compile classpath with ${buildState.compileClasspath.size} elements")

                buildState.compileClasspath.forEach { classpathElement ->
                    log.info("Adding compile classpath element: $classpathElement")
                    project.compileClasspathElements.add(classpathElement)
                }
            }
            if (buildState.testClasspath.isNotEmpty()) {
                log.info("Recorded test classpath with ${buildState.testClasspath.size} elements")

                buildState.testClasspath.forEach { classpathElement ->
                    log.info("Adding test classpath element: $classpathElement")
                    project.testClasspathElements.add(classpathElement)
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
