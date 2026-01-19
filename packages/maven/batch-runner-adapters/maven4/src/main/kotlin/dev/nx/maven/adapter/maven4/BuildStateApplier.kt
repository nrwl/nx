package dev.nx.maven.adapter.maven4

import dev.nx.maven.shared.BuildState
import dev.nx.maven.shared.PathUtils

import org.apache.maven.model.Resource
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Utility for applying build state to Maven projects.
 *
 * Note on warnings: This class uses warnings (not errors) for missing files/artifacts
 * because build state may reference files that don't exist yet in incremental builds,
 * or were cleaned between builds. These conditions are recoverable - Maven will rebuild
 * the missing artifacts as needed. Failing hard would break valid incremental build scenarios.
 */
object BuildStateApplier {
    private val log: Logger = LoggerFactory.getLogger(BuildStateApplier::class.java)

    /**
     * Apply a build state to a Maven project.
     *
     * @param project The MavenProject to apply state to
     * @param buildState The BuildState to apply
     * @param projectHelper Optional MavenProjectHelper for attaching artifacts
     */
    fun applyBuildState(
        project: MavenProject,
        buildState: BuildState,
        projectHelper: MavenProjectHelper? = null
    ) {
        val basedir = project.basedir

        // Apply compile source roots
        val compileSourceRoots = PathUtils.toAbsolutePaths(buildState.compileSourceRoots, basedir, log)
        compileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addCompileSourceRoot(path)
            }
        }
        if (compileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${compileSourceRoots.size} compile source roots")
        }

        // Apply test compile source roots
        val testCompileSourceRoots = PathUtils.toAbsolutePaths(buildState.testCompileSourceRoots, basedir, log)
        testCompileSourceRoots.forEach { path ->
            if (File(path).isDirectory) {
                project.addTestCompileSourceRoot(path)
            }
        }
        if (testCompileSourceRoots.isNotEmpty()) {
            log.debug("    Added ${testCompileSourceRoots.size} test compile source roots")
        }

        // Apply resources
        val resources = PathUtils.toAbsolutePaths(buildState.resources, basedir, log)
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
        val testResources = PathUtils.toAbsolutePaths(buildState.testResources, basedir, log)
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
            } else {
                log.warn("    Main artifact file does not exist: ${file.absolutePath}")
            }
        }

        // Apply attached artifacts (only if files exist and not already attached)
        var attachedCount = 0
        buildState.attachedArtifacts.forEach { artifactInfo ->
            val absPath = PathUtils.toAbsolutePath(artifactInfo.file, basedir, log)
            val file = File(absPath)
            if (file.exists()) {
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
            } else {
                log.warn("    Attached artifact file does not exist: ${file.absolutePath}")
            }
        }
        if (attachedCount > 0) {
            log.debug("    Applied $attachedCount attached artifacts")
        }

        // Skip outputTimestamp - it causes cache invalidation issues

        // Apply pomFile if it was modified (e.g., by flatten-maven-plugin)
        buildState.pomFile?.let {
            val absPath = PathUtils.toAbsolutePath(it, basedir, log)
            val pomFile = File(absPath)
            if (pomFile.exists()) {
                log.info("Applying modified pomFile: ${pomFile.absolutePath}")
                project.file = pomFile
            } else {
                log.warn("Modified pomFile does not exist, skipping: ${pomFile.absolutePath}")
            }
        }
    }
}
