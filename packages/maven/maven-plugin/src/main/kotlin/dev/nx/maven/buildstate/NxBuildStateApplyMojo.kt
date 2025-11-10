package dev.nx.maven.buildstate

import com.fasterxml.jackson.databind.ObjectMapper
import dev.nx.maven.shared.BuildState
import dev.nx.maven.shared.BuildStateApplier
import org.apache.maven.execution.MavenSession
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

    private fun applyAllBuildStates() {
        val projectsToApply = session.allProjects.mapNotNull { depProject ->
            val stateFile = File(depProject.build.directory, BUILD_STATE_FILE)
            if (stateFile.exists()) depProject to stateFile else null
        }

        if (projectsToApply.isNotEmpty()) {
            log.info("Applying build state to ${projectsToApply.size} projects...")
            projectsToApply.forEach { (depProject, stateFile) ->
                try {
                    val buildState = objectMapper.readValue(stateFile, BuildState::class.java)
                    BuildStateApplier.applyBuildState(depProject, buildState, projectHelper)
                } catch (e: Exception) {
                    log.warn("Failed to apply build state to ${depProject.artifactId}: ${e.message}")
                }
            }
        } else {
            log.info("No build state files found in dependency projects")
        }
    }
}
