package dev.nx.maven.shared

import org.apache.maven.model.Resource
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.nio.file.NoSuchFileException
import java.nio.file.Path

/**
 * Utility for applying build state to Maven projects.
 *
 * Paths that no longer exist are skipped rather than failing the build, because build state
 * may reference files that were cleaned between builds. Maven rebuilds them as needed.
 *
 * The build state file can be restored from a remote cache, so its paths are only applied when
 * they stay where the recorder would have put them: inputs inside the workspace or the project,
 * output directories inside the build directory or where the POM already points them.
 */
object BuildStateApplier {
    private val log: Logger = LoggerFactory.getLogger(BuildStateApplier::class.java)

    private fun realPath(root: File): Path =
        runCatching { root.toPath().toRealPath() }.getOrElse { root.canonicalFile.toPath() }

    private fun resolveWithin(path: String, basedir: File, roots: List<Path>, warnIfMissing: Boolean = false): String? {
        val resolved = try {
            File(path).let { if (it.isAbsolute) it else File(basedir, path) }.toPath().toRealPath()
        } catch (_: NoSuchFileException) {
            val message = "    Skipping missing build state path: $path"
            if (warnIfMissing) log.warn(message) else log.debug(message)
            return null
        } catch (_: Exception) {
            null
        }
        if (resolved != null && roots.any { resolved.startsWith(it) }) {
            return resolved.toString()
        }
        log.warn("    Ignoring build state path outside of ${roots.joinToString()}: $path")
        return null
    }

    private fun resolveAllWithin(paths: Set<String>, basedir: File, roots: List<Path>): Set<String> {
        return paths.mapNotNull { resolveWithin(it, basedir, roots) }.toSet()
    }

    /**
     * Apply a build state to a Maven project.
     *
     * @param project The MavenProject to apply state to
     * @param buildState The BuildState to apply
     * @param workspaceRoot Paths Maven reads from must resolve inside this directory
     * @param projectHelper Optional MavenProjectHelper for attaching artifacts
     */
    fun applyBuildState(
        project: MavenProject,
        buildState: BuildState,
        workspaceRoot: File,
        projectHelper: MavenProjectHelper? = null
    ) {
        val basedir = project.basedir
        val buildDirectory = File(project.build.directory)
        val buildRoot = realPath(buildDirectory)
        val inputRoots = listOf(realPath(workspaceRoot), realPath(basedir), buildRoot)

        // Apply compile source roots
        val compileSourceRoots = resolveAllWithin(buildState.compileSourceRoots, basedir, inputRoots)
        compileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addCompileSourceRoot(path)
            }
        }
        if (compileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${compileSourceRoots.size} compile source roots")
        }

        // Apply test compile source roots
        val testCompileSourceRoots = resolveAllWithin(buildState.testCompileSourceRoots, basedir, inputRoots)
        testCompileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addTestCompileSourceRoot(path)
            }
        }
        if (testCompileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${testCompileSourceRoots.size} test compile source roots")
        }

        // Apply resources
        val resources = resolveAllWithin(buildState.resources, basedir, inputRoots)
        resources.forEach { path ->
            if (File(path).isDirectory) {
                val resource = Resource().apply { directory = path }
                project.addResource(resource)
            }
        }
        if (resources.isNotEmpty()) {
            log.debug("    Added ${resources.size} resource directories")
        }

        // Apply test resources
        val testResources = resolveAllWithin(buildState.testResources, basedir, inputRoots)
        testResources.forEach { path ->
            if (File(path).isDirectory) {
                val resource = Resource().apply { directory = path }
                project.addTestResource(resource)
            }
        }
        if (testResources.isNotEmpty()) {
            log.debug("    Added ${testResources.size} test resource directories")
        }

        // Apply output directories
        buildState.outputDirectory?.let {
            resolveWithin(it, basedir, listOfNotNull(buildRoot, project.build.outputDirectory?.let { dir -> realPath(File(dir)) }))
        }?.let { absPath ->
            if (File(absPath).isDirectory) {
                project.build.outputDirectory = absPath
                log.debug("    Set output directory: $absPath")
            }
        }

        buildState.testOutputDirectory?.let {
            resolveWithin(it, basedir, listOfNotNull(buildRoot, project.build.testOutputDirectory?.let { dir -> realPath(File(dir)) }))
        }?.let { absPath ->
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

        // Apply main artifact
        buildState.mainArtifact?.let { resolveWithin(it.file, basedir, inputRoots, warnIfMissing = true) }?.let { absPath ->
            val file = File(absPath)
            log.debug("    Applied main artifact: ${file.name}")
            project.artifact.file = file
        }

        // Apply attached artifacts (only if not already attached)
        var attachedCount = 0
        buildState.attachedArtifacts.forEach { artifactInfo ->
            val absPath = resolveWithin(artifactInfo.file, basedir, inputRoots, warnIfMissing = true) ?: return@forEach
            val file = File(absPath)
            if (projectHelper != null) {
                val classifier = artifactInfo.classifier
                // Check if already attached to avoid "already attached, replacing" warnings
                val alreadyAttached = project.attachedArtifacts.any { existing ->
                    existing.type == artifactInfo.type &&
                    (existing.classifier ?: "") == (classifier ?: "")
                }
                if (!alreadyAttached) {
                    when {
                        classifier.isNullOrEmpty() -> projectHelper.attachArtifact(project, artifactInfo.type, file)
                        else -> projectHelper.attachArtifact(project, artifactInfo.type, classifier, file)
                    }
                    attachedCount++
                }
            } else {
                log.warn("    Cannot attach artifact (no MavenProjectHelper): ${file.name}")
            }
        }
        if (attachedCount > 0) {
            log.debug("    Applied $attachedCount attached artifacts")
        }

        // Skip outputTimestamp - it causes cache invalidation issues

        // Apply pomFile if it was modified (e.g., by flatten-maven-plugin)
        buildState.pomFile?.let { resolveWithin(it, basedir, inputRoots, warnIfMissing = true) }?.let { absPath ->
            val pomFile = File(absPath)
            log.info("Applying modified pomFile: ${pomFile.absolutePath}")
            project.setPomFile(pomFile)
        }
    }
}
