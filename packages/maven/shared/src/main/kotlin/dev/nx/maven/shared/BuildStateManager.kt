package dev.nx.maven.shared

import com.google.gson.Gson
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Manager for applying and recording build states to/from MavenProject objects.
 * Works with both Maven 3.x and 4.x since they share the same MavenProject API.
 */
object BuildStateManager {
    private const val BUILD_STATE_FILE = "nx-build-state.json"
    private val log = LoggerFactory.getLogger(BuildStateManager::class.java)
    private val gson = Gson()
    private var projectHelper: MavenProjectHelper? = null

    /**
     * Initialize the BuildStateManager with MavenProjectHelper.
     * The caller is responsible for looking up the helper via their DI container
     * (Lookup for Maven 4, PlexusContainer for Maven 3).
     */
    fun initialize(helper: MavenProjectHelper?) {
        projectHelper = helper
        if (helper != null) {
            log.debug("MavenProjectHelper initialized successfully")
        } else {
            log.warn("MavenProjectHelper is null - artifact attachment will be disabled")
        }
    }

    /**
     * Apply build states to all projects that have nx-build-state.json files.
     */
    fun applyBuildStates(allProjects: List<MavenProject>) {
        val startTime = System.currentTimeMillis()
        log.debug("Checking ${allProjects.size} projects for build state files...")

        val projectsToApply = allProjects.mapNotNull { project ->
            val stateFile = File(project.build.directory, BUILD_STATE_FILE)
            if (stateFile.exists()) {
                log.debug("  Found build state for ${project.groupId}:${project.artifactId}")
                project to stateFile
            } else {
                null
            }
        }

        if (projectsToApply.isEmpty()) {
            log.debug("No build state files found")
            return
        }

        log.debug("Applying build states to ${projectsToApply.size} projects...")
        projectsToApply.forEach { (project, stateFile) ->
            try {
                val buildState = gson.fromJson(stateFile.readText(), BuildState::class.java)
                BuildStateApplier.applyBuildState(project, buildState, projectHelper)
                log.debug("  Applied build state for ${project.groupId}:${project.artifactId}")
            } catch (e: Exception) {
                log.error("  Failed to apply build state to ${project.artifactId}: ${e.message}", e)
            }
        }

        val duration = System.currentTimeMillis() - startTime
        log.debug("Build state application completed (took ${duration}ms)")
    }

    /**
     * Record the build state of a Maven project to nx-build-state.json.
     */
    fun recordBuildState(project: MavenProject) {
        BuildStateRecorder.recordBuildState(project)
    }
}
