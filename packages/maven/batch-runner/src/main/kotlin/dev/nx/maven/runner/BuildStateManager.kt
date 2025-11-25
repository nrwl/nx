package dev.nx.maven.runner

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.api.services.Lookup
import org.apache.maven.artifact.Artifact
import org.apache.maven.model.Resource
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.nio.file.Paths

/**
 * Data class representing the build state of a Maven project
 */
data class BuildState @JsonCreator constructor(
    @JsonProperty("compileSourceRoots") val compileSourceRoots: Set<String>,
    @JsonProperty("testCompileSourceRoots") val testCompileSourceRoots: Set<String>,
    @JsonProperty("resources") val resources: Set<String> = emptySet(),
    @JsonProperty("testResources") val testResources: Set<String> = emptySet(),
    @JsonProperty("outputDirectory") val outputDirectory: String? = null,
    @JsonProperty("testOutputDirectory") val testOutputDirectory: String? = null,
    @JsonProperty("compileClasspath") val compileClasspath: Set<String> = emptySet(),
    @JsonProperty("testClasspath") val testClasspath: Set<String> = emptySet(),
    @JsonProperty("mainArtifact") val mainArtifact: ArtifactInfo?,
    @JsonProperty("attachedArtifacts") val attachedArtifacts: List<ArtifactInfo>,
    @JsonProperty("outputTimestamp") val outputTimestamp: String? = null
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

/**
 * Utility object for converting between absolute and relative paths
 */
object PathUtils {

    /**
     * Convert an absolute path to a relative path from the project root
     */
    fun toRelativePath(absolutePath: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val absPath = File(absolutePath).canonicalPath
            val rootPath = projectRoot.canonicalPath
            Paths.get(rootPath).relativize(Paths.get(absPath)).toString()
        } catch (_: Exception) {
            logger?.warn("Failed to convert absolute path to relative: $absolutePath, using absolute path")
            absolutePath
        }
    }

    /**
     * Convert a relative path to an absolute path based on the project root
     */
    fun toAbsolutePath(pathString: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val path = File(pathString)
            if (path.isAbsolute) {
                path.canonicalPath
            } else {
                File(projectRoot, pathString).canonicalPath
            }
        } catch (_: Exception) {
            logger?.warn("Failed to convert relative path to absolute: $pathString, using as-is")
            pathString
        }
    }

    /**
     * Convert a set of absolute paths to relative paths
     */
    fun toRelativePaths(absolutePaths: Set<String>, projectRoot: File, logger: Logger? = null): Set<String> {
        return absolutePaths.map { toRelativePath(it, projectRoot, logger) }.toSet()
    }

    /**
     * Convert a set of paths (potentially relative) to absolute paths
     */
    fun toAbsolutePaths(paths: Set<String>, projectRoot: File, logger: Logger? = null): Set<String> {
        return paths.map { toAbsolutePath(it, projectRoot, logger) }.toSet()
    }
}

/**
 * Manager for applying and recording build states to/from MavenProject objects.
 * This allows the batch runner to preserve build artifacts and state across executions
 * without invoking Maven goals.
 */
object BuildStateManager {
    private const val BUILD_STATE_FILE = "nx-build-state.json"
    private val log: Logger = LoggerFactory.getLogger(BuildStateManager::class.java)
    private val objectMapper = ObjectMapper()
    private var projectHelper: MavenProjectHelper? = null

    /**
     * Initialize the BuildStateManager with Maven's lookup container
     */
    fun initialize(lookup: Lookup) {
        try {
            projectHelper = lookup.lookup(MavenProjectHelper::class.java)
            log.debug("MavenProjectHelper initialized successfully")
        } catch (e: Exception) {
            log.warn("Failed to lookup MavenProjectHelper: ${e.message}")
            projectHelper = null
        }
    }

    /**
     * Apply build states to all projects that have nx-build-state.json files.
     * Reads the build state from target/nx-build-state.json and updates the MavenProject
     * with artifacts, source roots, and other build information.
     *
     * @param allProjects List of all MavenProject objects in the reactor
     */
    fun applyBuildStates(allProjects: List<MavenProject>) {
        val startTime = System.currentTimeMillis()

        log.debug("Checking ${allProjects.size} projects for build state files...")

        val projectsToApply = allProjects.mapNotNull { project ->
            val stateFile = File(project.build.directory, BUILD_STATE_FILE)
            if (stateFile.exists()) {
                log.debug("  ✓ Found build state for ${project.groupId}:${project.artifactId} at ${stateFile.absolutePath}")
                project to stateFile
            } else {
                log.debug("  ✗ No build state for ${project.groupId}:${project.artifactId}")
                null
            }
        }

        if (projectsToApply.isEmpty()) {
            log.debug("No build state files found - skipping application")
            return
        }

        log.debug("Applying build states to ${projectsToApply.size} projects...")

        projectsToApply.forEach { (project, stateFile) ->
            try {
                val buildState = objectMapper.readValue(stateFile, BuildState::class.java)
                applyBuildStateToProject(project, buildState)
                log.debug("  ✓ Applied build state for ${project.groupId}:${project.artifactId}")
            } catch (e: Exception) {
                log.error("  ✗ Failed to apply build state to ${project.artifactId}: ${e.message}", e)
            }
        }

        val duration = System.currentTimeMillis() - startTime
        log.debug("Build state application completed for ${projectsToApply.size} projects (took ${duration}ms)")
    }

    /**
     * Apply a build state to a single Maven project
     */
    private fun applyBuildStateToProject(project: MavenProject, buildState: BuildState) {
        val basedir = project.basedir
        var appliedCount = 0

        // Convert relative paths to absolute and apply source roots
        val compileSourceRoots = PathUtils.toAbsolutePaths(buildState.compileSourceRoots, basedir, log)
        compileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addCompileSourceRoot(path)
                appliedCount++
            }
        }
        if (compileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${compileSourceRoots.size} compile source roots")
        }

        val testCompileSourceRoots = PathUtils.toAbsolutePaths(buildState.testCompileSourceRoots, basedir, log)
        testCompileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addTestCompileSourceRoot(path)
                appliedCount++
            }
        }
        if (testCompileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${testCompileSourceRoots.size} test compile source roots")
        }

        // Convert relative paths to absolute and apply resources
        val resources = PathUtils.toAbsolutePaths(buildState.resources, basedir, log)
        resources.forEach { path ->
            if (File(path).isDirectory) {
                val resource = Resource().apply { directory = path }
                project.addResource(resource)
                appliedCount++
            }
        }
        if (resources.isNotEmpty()) {
            log.debug("    Added ${resources.size} resource directories")
        }

        val testResources = PathUtils.toAbsolutePaths(buildState.testResources, basedir, log)
        testResources.forEach { path ->
            if (File(path).isDirectory) {
                val resource = Resource().apply { directory = path }
                project.addTestResource(resource)
                appliedCount++
            }
        }
        if (testResources.isNotEmpty()) {
            log.debug("    Added ${testResources.size} test resource directories")
        }

        // Apply output directories
        buildState.outputDirectory?.let {
            val absPath = PathUtils.toAbsolutePath(it, basedir, log)
            if (File(absPath).isDirectory) {
                project.build.outputDirectory = absPath
                log.debug("    Set output directory: $absPath")
            }
        }

        buildState.testOutputDirectory?.let {
            val absPath = PathUtils.toAbsolutePath(it, basedir, log)
            if (File(absPath).isDirectory) {
                project.build.testOutputDirectory = absPath
                log.debug("    Set test output directory: $absPath")
            }
        }

        // Apply classpaths
        val compileClasspath = PathUtils.toAbsolutePaths(buildState.compileClasspath, basedir, log)
        if (compileClasspath.isNotEmpty()) {
            project.compileClasspathElements.addAll(compileClasspath)
            log.debug("    Added ${compileClasspath.size} compile classpath elements")
        }

        val testClasspath = PathUtils.toAbsolutePaths(buildState.testClasspath, basedir, log)
        if (testClasspath.isNotEmpty()) {
            project.testClasspathElements.addAll(testClasspath)
            log.debug("    Added ${testClasspath.size} test classpath elements")
        }

        // Apply main artifact (only if file exists)
        buildState.mainArtifact?.let { artifactInfo ->
            val absPath = PathUtils.toAbsolutePath(artifactInfo.file, basedir, log)
            val file = File(absPath)
            if (file.exists()) {
                log.debug("    Applied main artifact: ${file.name}")
                project.artifact.file = file
                appliedCount++
            } else {
                log.warn("    Main artifact file does not exist: ${file.absolutePath}")
            }
        }

        // Apply attached artifacts (only if files exist)
        var attachedCount = 0
        buildState.attachedArtifacts.forEach { artifactInfo ->
            val absPath = PathUtils.toAbsolutePath(artifactInfo.file, basedir, log)
            val file = File(absPath)
            if (file.exists()) {
                if (projectHelper != null) {
                    // Use MavenProjectHelper if available (proper Maven way)
                    val classifier = artifactInfo.classifier
                    when {
                        classifier.isNullOrEmpty() -> projectHelper!!.attachArtifact(project, artifactInfo.type, file)
                        else -> projectHelper!!.attachArtifact(project, artifactInfo.type, classifier, file)
                    }
                    attachedCount++
                } else {
                    // Fallback: skip attaching artifacts if projectHelper is not available
                    log.warn("    Cannot attach artifact (no MavenProjectHelper): ${file.name}")
                }
            } else {
                log.warn("    Attached artifact file does not exist: ${file.absolutePath}")
            }
        }
        if (attachedCount > 0) {
            log.debug("    Applied ${attachedCount} attached artifacts")
        }

        // Skip outputTimestamp - it causes cache invalidation issues
    }

    /**
     * Record the build state of a Maven project to nx-build-state.json.
     * Extracts build information from the MavenProject and saves it to target/nx-build-state.json.
     *
     * @param project The MavenProject to record
     * @return true if successful, false otherwise
     */
    fun recordBuildState(project: MavenProject): Boolean {
        val startTime = System.currentTimeMillis()

        return try {
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

            // Capture output directories and convert to relative paths
            val outputDirectory = project.build.outputDirectory?.let {
                PathUtils.toRelativePath(it, basedir, log)
            }
            val testOutputDirectory = project.build.testOutputDirectory?.let {
                PathUtils.toRelativePath(it, basedir, log)
            }

            // Capture compile classpath and convert to relative paths
            val compileClasspath = captureClasspath("compile", project.compileClasspathElements, basedir)

            // Capture test classpath and convert to relative paths
            val testClasspath = captureClasspath("test", project.testClasspathElements, basedir)

            // Capture main artifact (only if file exists)
            val mainArtifact = captureMainArtifact(project, basedir)

            // Capture attached artifacts (only if file exists)
            val attachedArtifacts = captureAttachedArtifacts(project, basedir)

            // Don't capture outputTimestamp - it causes cache invalidation issues

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
                outputTimestamp = null
            )

            // Ensure output directory exists
            val outputFile = File(project.build.directory, BUILD_STATE_FILE)
            outputFile.parentFile?.mkdirs()

            // Write to JSON file
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputFile, buildState)

            val duration = System.currentTimeMillis() - startTime
            log.debug("    ✓ Recorded to ${outputFile.absolutePath} (took ${duration}ms)")
            log.debug("    Contents: ${compileSourceRoots.size} source roots, " +
                "${resources.size} resources, " +
                "${if (mainArtifact != null) "1 main artifact" else "no main artifact"}, " +
                "${attachedArtifacts.size} attached artifacts")

            true
        } catch (e: Exception) {
            log.error("    ✗ Failed to record build state for ${project.artifactId}: ${e.message}", e)
            false
        }
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
