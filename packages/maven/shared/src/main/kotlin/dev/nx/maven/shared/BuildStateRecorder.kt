package dev.nx.maven.shared

import com.google.gson.GsonBuilder
import org.apache.maven.artifact.Artifact
import org.apache.maven.model.Resource
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Utility for recording build state from Maven projects.
 */
object BuildStateRecorder {
    private const val BUILD_STATE_FILE = "nx-build-state.json"
    private val log: Logger = LoggerFactory.getLogger(BuildStateRecorder::class.java)
    private val gson = GsonBuilder().setPrettyPrinting().create()

    /**
     * Cache of the last-written BuildState per project (keyed by "groupId:artifactId").
     * Used to skip redundant JSON serialization and file I/O when the state hasn't changed.
     */
    private val lastWrittenState = ConcurrentHashMap<String, BuildState>()

    /**
     * Cache of canonicalized path mappings to avoid repeated filesystem syscalls.
     * Key: absolute path, Value: relative path from project root.
     * File.canonicalPath is a syscall that resolves symlinks — caching it avoids
     * hundreds of redundant syscalls per recording (especially for classpath entries
     * pointing to ~/.m2/repository).
     */
    private val canonicalPathCache = ConcurrentHashMap<Pair<String, String>, String>()

    private fun toRelativePathCached(absolutePath: String, projectRoot: File): String {
        val rootPath = projectRoot.absolutePath
        val key = Pair(absolutePath, rootPath)
        return canonicalPathCache.getOrPut(key) {
            PathUtils.toRelativePath(absolutePath, projectRoot, log)
        }
    }

    private fun toRelativePathsCached(absolutePaths: Set<String>, projectRoot: File): Set<String> {
        return absolutePaths.map { toRelativePathCached(it, projectRoot) }.toSet()
    }

    /**
     * Record the build state of a Maven project to nx-build-state.json.
     * Computes the full state every time for correctness, but skips the file write
     * if the state is identical to what was last written.
     *
     * @param project The MavenProject to record
     * @throws Exception if recording fails
     */
    fun recordBuildState(project: MavenProject) {
        val selector = "${project.groupId}:${project.artifactId}"
        val startTime = System.currentTimeMillis()
        log.debug("  Recording build state for ${project.groupId}:${project.artifactId}...")
        val basedir = project.basedir

        // Capture compile source roots
        val compileSourceRootsAbsolute = project.compileSourceRoots.toSet()
        val compileSourceRoots = toRelativePathsCached(compileSourceRootsAbsolute, basedir)

        // Capture test compile source roots
        val testCompileSourceRootsAbsolute = project.testCompileSourceRoots.toSet()
        val testCompileSourceRoots = toRelativePathsCached(testCompileSourceRootsAbsolute, basedir)

        // Capture resources
        val resourcesAbsolute = project.resources.map { (it as Resource).directory }.filter { it != null }.toSet()
        val resources = toRelativePathsCached(resourcesAbsolute, basedir)

        // Capture test resources
        val testResourcesAbsolute = project.testResources.map { (it as Resource).directory }.filter { it != null }.toSet()
        val testResources = toRelativePathsCached(testResourcesAbsolute, basedir)

        // Capture output directories
        val outputDirectory = project.build.outputDirectory?.let {
            toRelativePathCached(it, basedir)
        }
        val testOutputDirectory = project.build.testOutputDirectory?.let {
            toRelativePathCached(it, basedir)
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
            val relativePath = toRelativePathCached(currentPomFile.absolutePath, basedir)
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

        // Skip write if state is identical to last write and file still exists on disk
        val outputFile = File(project.build.directory, BUILD_STATE_FILE)
        val lastState = lastWrittenState[selector]
        if (lastState != null && lastState == buildState && outputFile.exists()) {
            val duration = System.currentTimeMillis() - startTime
            log.debug("  Skipping write for $selector — state unchanged (took ${duration}ms)")
            return
        }

        // Write to file
        outputFile.parentFile?.mkdirs()
        outputFile.writeText(gson.toJson(buildState))
        lastWrittenState[selector] = buildState

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
        return toRelativePathsCached(absolutePaths, basedir)
    }

    private fun captureMainArtifact(project: MavenProject, basedir: File): ArtifactInfo? {
        val artifactFile = project.artifact?.file
        if (artifactFile != null && artifactFile.exists()) {
            return ArtifactInfo(
                file = toRelativePathCached(artifactFile.absolutePath, basedir),
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
                    file = toRelativePathCached(artifact.file.absolutePath, basedir),
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
