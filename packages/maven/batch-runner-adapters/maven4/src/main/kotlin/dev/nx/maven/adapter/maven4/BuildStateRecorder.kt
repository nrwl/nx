package dev.nx.maven.adapter.maven4

import com.google.gson.GsonBuilder
import dev.nx.maven.shared.ArtifactInfo
import dev.nx.maven.shared.BuildState
import dev.nx.maven.shared.PathUtils
import org.apache.maven.artifact.Artifact
import org.apache.maven.model.Resource
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Utility for recording build state from Maven projects.
 */
object BuildStateRecorder {
    private const val BUILD_STATE_FILE = "nx-build-state.json"
    private val log: Logger = LoggerFactory.getLogger(BuildStateRecorder::class.java)
    private val gson = GsonBuilder().setPrettyPrinting().create()

    /**
     * Record the build state of a Maven project to nx-build-state.json.
     *
     * @param project The MavenProject to record
     * @throws Exception if recording fails
     */
    fun recordBuildState(project: MavenProject) {
        val startTime = System.currentTimeMillis()
        log.debug("  Recording build state for ${project.groupId}:${project.artifactId}...")
        val basedir = project.basedir

        // Capture compile source roots
        val compileSourceRootsAbsolute = project.compileSourceRoots.toSet()
        val compileSourceRoots = PathUtils.toRelativePaths(compileSourceRootsAbsolute, basedir, log)

        // Capture test compile source roots
        val testCompileSourceRootsAbsolute = project.testCompileSourceRoots.toSet()
        val testCompileSourceRoots = PathUtils.toRelativePaths(testCompileSourceRootsAbsolute, basedir, log)

        // Capture resources
        val resourcesAbsolute = project.resources.map { (it as Resource).directory }.filter { it != null }.toSet()
        val resources = PathUtils.toRelativePaths(resourcesAbsolute, basedir, log)

        // Capture test resources
        val testResourcesAbsolute = project.testResources.map { (it as Resource).directory }.filter { it != null }.toSet()
        val testResources = PathUtils.toRelativePaths(testResourcesAbsolute, basedir, log)

        // Capture output directories
        val outputDirectory = project.build.outputDirectory?.let {
            PathUtils.toRelativePath(it, basedir, log)
        }
        val testOutputDirectory = project.build.testOutputDirectory?.let {
            PathUtils.toRelativePath(it, basedir, log)
        }

        // Capture classpaths
        val compileClasspath = captureClasspath("compile", project.compileClasspathElements, basedir)
        val testClasspath = captureClasspath("test", project.testClasspathElements, basedir)

        // Capture artifacts
        val mainArtifact = captureMainArtifact(project, basedir)
        val attachedArtifacts = captureAttachedArtifacts(project, basedir)

        // Capture pomFile if it differs from the default pom.xml
        // This is important for plugins like flatten-maven-plugin that modify the pom file path
        val defaultPomFile = File(basedir, "pom.xml")
        val currentPomFile = project.file
        val pomFile = if (currentPomFile != null && currentPomFile.canonicalPath != defaultPomFile.canonicalPath) {
            val relativePath = PathUtils.toRelativePath(currentPomFile.absolutePath, basedir, log)
            log.info("Captured non-default pomFile: $relativePath (modified by a plugin like flatten-maven-plugin)")
            relativePath
        } else {
            null
        }

        // Create build state (skip outputTimestamp - causes cache invalidation)
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
            outputTimestamp = null,
            pomFile = pomFile
        )

        // Write to file
        val outputFile = File(project.build.directory, BUILD_STATE_FILE)
        outputFile.parentFile?.mkdirs()
        outputFile.writeText(gson.toJson(buildState))

        val duration = System.currentTimeMillis() - startTime
        log.debug("    Recorded to ${outputFile.absolutePath} (took ${duration}ms)")
        log.debug("    Contents: ${compileSourceRoots.size} source roots, " +
            "${resources.size} resources, " +
            "${if (mainArtifact != null) "1 main artifact" else "no main artifact"}, " +
            "${attachedArtifacts.size} attached artifacts")
    }

    private fun captureClasspath(classpathType: String, classpathElements: List<String>, basedir: File): Set<String> {
        val absolutePaths = try {
            classpathElements.toSet()
        } catch (e: Exception) {
            log.warn("Failed to capture $classpathType classpath: ${e.message}")
            emptySet<String>()
        }
        return PathUtils.toRelativePaths(absolutePaths, basedir, log)
    }

    private fun captureMainArtifact(project: MavenProject, basedir: File): ArtifactInfo? {
        val artifactFile = project.artifact?.file
        if (artifactFile != null && artifactFile.exists()) {
            return ArtifactInfo(
                file = PathUtils.toRelativePath(artifactFile.absolutePath, basedir, log),
                type = project.artifact.type,
                classifier = project.artifact.classifier,
                groupId = project.artifact.groupId,
                artifactId = project.artifact.artifactId,
                version = project.artifact.version
            )
        } else if (artifactFile != null) {
            log.debug("Main artifact file does not exist: ${artifactFile.absolutePath}")
        }
        return null
    }

    private fun captureAttachedArtifacts(project: MavenProject, basedir: File): List<ArtifactInfo> {
        return project.attachedArtifacts.mapNotNull { artifact: Artifact ->
            when {
                artifact.file == null -> {
                    log.debug("Attached artifact has no file: ${artifact.groupId}:${artifact.artifactId}:${artifact.version}")
                    null
                }
                !artifact.file.exists() -> {
                    log.debug("Attached artifact file does not exist: ${artifact.file.absolutePath}")
                    null
                }
                // Skip temporary files (consumer POMs with random hash names)
                artifact.file.name.startsWith("consumer-") && artifact.file.name.matches(Regex("consumer-\\d+\\.pom")) -> {
                    log.debug("Skipping temporary consumer POM: ${artifact.file.name}")
                    null
                }
                else -> ArtifactInfo(
                    file = PathUtils.toRelativePath(artifact.file.absolutePath, basedir, log),
                    type = artifact.type,
                    classifier = artifact.classifier,
                    groupId = artifact.groupId,
                    artifactId = artifact.artifactId,
                    version = artifact.version
                )
            }
        }
    }
}
