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
            val stateFile = File(depProject.build.directory, "nx-build-state.json")
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
            // Apply source roots
            buildState.compileSourceRoots.forEach { addIfExists(it) { targetProject.addCompileSourceRoot(it) } }
            buildState.testCompileSourceRoots.forEach { addIfExists(it) { targetProject.addTestCompileSourceRoot(it) } }

            // Apply resources
            buildState.resources.forEach { addResourceIfExists(it, targetProject::addResource) }
            buildState.testResources.forEach { addResourceIfExists(it, targetProject::addTestResource) }

            // Apply output directories
            buildState.outputDirectory?.let { if (File(it).isDirectory) targetProject.build.outputDirectory = it }
            buildState.testOutputDirectory?.let { if (File(it).isDirectory) targetProject.build.testOutputDirectory = it }

            // Apply classpaths - include all files, not just JARs
            buildState.compileClasspath.forEach { targetProject.compileClasspathElements.add(it) }
            buildState.testClasspath.forEach { targetProject.testClasspathElements.add(it) }
        }

        // Apply main artifact (only if file exists)
        buildState.mainArtifact?.let { artifact ->
            val file = File(artifact.file)
            if (file.exists()) {
                log.info("Applying main artifact: ${file.absolutePath} to ${targetProject.artifactId}")
                targetProject.artifact.file = file
            } else {
                log.warn("Main artifact file does not exist, skipping: ${file.absolutePath}")
            }
        }

        // Apply attached artifacts (only if file exists)
        buildState.attachedArtifacts.forEach { artifact ->
            val file = File(artifact.file)
            if (file.exists()) {
                log.info("Applying attached artifact: ${file.absolutePath} to ${targetProject.artifactId}")
                if (artifact.classifier.isNullOrEmpty()) {
                    projectHelper.attachArtifact(targetProject, artifact.type, file)
                } else {
                    projectHelper.attachArtifact(targetProject, artifact.type, artifact.classifier, file)
                }
            } else {
                log.warn("Attached artifact file does not exist, skipping: ${file.absolutePath}")
            }
        }

        // Apply outputTimestamp
        buildState.outputTimestamp?.let {
            targetProject.properties.setProperty("project.build.outputTimestamp", it)
        }
    }
}
