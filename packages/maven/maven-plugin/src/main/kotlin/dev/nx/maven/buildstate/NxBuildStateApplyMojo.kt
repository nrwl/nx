package dev.nx.maven.buildstate

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.execution.MavenSession
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

    companion object {
        private const val BUILD_STATE_FILE = "nx-build-state.json"
    }

    private val log: Logger = LoggerFactory.getLogger(NxBuildStateApplyMojo::class.java)
    private val objectMapper = ObjectMapper()

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Component
    private lateinit var projectHelper: MavenProjectHelper

    @Throws(MojoExecutionException::class)
    override fun execute() {
        val startTime = System.currentTimeMillis()
        try {
            applyAllBuildStates()
            val duration = System.currentTimeMillis() - startTime
            log.info("Build state application completed (took ${duration}ms)")
        } catch (e: Exception) {
            throw MojoExecutionException("Failed to reapply build state", e)
        }
    }

    private fun addIfExists(path: String, action: () -> Unit) {
        if (File(path).isDirectory) action() else log.warn("Directory not found: $path")
    }

    private fun addResourceIfExists(path: String, action: (Resource) -> Unit) {
        if (File(path).isDirectory) {
            val resource = Resource().apply { directory = path }
            action(resource)
        } else {
            log.warn("Resource directory not found: $path")
        }
    }

    private fun applyAllBuildStates() {
        // Check all projects in the build - those with build state files will be applied
        val projectsToApply = session.allProjects.mapNotNull { depProject ->
            val stateFile = File(depProject.build.directory, BUILD_STATE_FILE)
            if (stateFile.exists()) depProject to stateFile else null
        }

        if (projectsToApply.isNotEmpty()) {
            log.info("Applying build state to ${projectsToApply.size} projects...")
            projectsToApply.parallelStream().forEach { (depProject, stateFile) ->
                try {
                    val buildState = objectMapper.readValue(stateFile, BuildState::class.java)
                    applyBuildStateToProject(depProject, buildState)
                } catch (e: Exception) {
                    log.warn("Failed to apply build state to ${depProject.artifactId}: ${e.message}")
                }
            }
        } else {
            log.info("No build state files found in dependency projects")
        }
    }

    private fun applyBuildStateToProject(targetProject: MavenProject, buildState: BuildState) {
        log.info("Applying build state for project: ${targetProject.artifactId}")

        // If this is the current project, apply source roots, resources, and output directories
        if (targetProject.artifactId == project.artifactId) {
            // Convert relative paths to absolute paths and apply source roots
            val compileSourceRoots = PathUtils.toAbsolutePaths(buildState.compileSourceRoots, targetProject.basedir, log)
            compileSourceRoots.forEach { addIfExists(it) { targetProject.addCompileSourceRoot(it) } }

            val testCompileSourceRoots = PathUtils.toAbsolutePaths(buildState.testCompileSourceRoots, targetProject.basedir, log)
            testCompileSourceRoots.forEach { addIfExists(it) { targetProject.addTestCompileSourceRoot(it) } }

            // Convert relative paths to absolute paths and apply resources
            val resources = PathUtils.toAbsolutePaths(buildState.resources, targetProject.basedir, log)
            resources.forEach { addResourceIfExists(it, targetProject::addResource) }

            val testResources = PathUtils.toAbsolutePaths(buildState.testResources, targetProject.basedir, log)
            testResources.forEach { addResourceIfExists(it, targetProject::addTestResource) }

            // Convert relative paths to absolute paths and apply output directories
            buildState.outputDirectory?.let {
                val absPath = PathUtils.toAbsolutePath(it, targetProject.basedir, log)
                if (File(absPath).isDirectory) targetProject.build.outputDirectory = absPath
            }
            buildState.testOutputDirectory?.let {
                val absPath = PathUtils.toAbsolutePath(it, targetProject.basedir, log)
                if (File(absPath).isDirectory) targetProject.build.testOutputDirectory = absPath
            }

            // Convert relative paths to absolute paths and apply classpaths
            val compileClasspath = PathUtils.toAbsolutePaths(buildState.compileClasspath, targetProject.basedir, log)
            targetProject.compileClasspathElements.addAll(compileClasspath)

            val testClasspath = PathUtils.toAbsolutePaths(buildState.testClasspath, targetProject.basedir, log)
            targetProject.testClasspathElements.addAll(testClasspath)
        }

        // Apply main artifact (only if file exists)
        buildState.mainArtifact?.let { applyMainArtifact(targetProject, it) }

        // Apply attached artifacts (only if file exists)
        buildState.attachedArtifacts.forEach { applyAttachedArtifact(targetProject, it) }

        // Apply outputTimestamp
        buildState.outputTimestamp?.let {
            targetProject.properties.setProperty("project.build.outputTimestamp", it)
        }
    }

    private fun applyMainArtifact(targetProject: MavenProject, artifact: ArtifactInfo) {
        val absPath = PathUtils.toAbsolutePath(artifact.file, targetProject.basedir, log)
        val file = File(absPath)
        if (file.exists()) {
            log.info("Applying main artifact: ${file.absolutePath} to ${targetProject.artifactId}")
            targetProject.artifact.file = file
        } else {
            log.warn("Main artifact file does not exist, skipping: ${file.absolutePath}")
        }
    }

    private fun applyAttachedArtifact(targetProject: MavenProject, artifact: ArtifactInfo) {
        val absPath = PathUtils.toAbsolutePath(artifact.file, targetProject.basedir, log)
        val file = File(absPath)
        if (file.exists()) {
            log.info("Applying attached artifact: ${file.absolutePath} to ${targetProject.artifactId}")
            val classifier = artifact.classifier
            when {
                classifier.isNullOrEmpty() -> projectHelper.attachArtifact(targetProject, artifact.type, file)
                else -> projectHelper.attachArtifact(targetProject, artifact.type, classifier, file)
            }
        } else {
            log.warn("Attached artifact file does not exist, skipping: ${file.absolutePath}")
        }
    }
}
