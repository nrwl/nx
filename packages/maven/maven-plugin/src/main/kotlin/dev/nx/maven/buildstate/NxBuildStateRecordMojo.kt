package dev.nx.maven.buildstate

import dev.nx.maven.shared.BuildStateRecorder
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import org.slf4j.LoggerFactory

/**
 * Maven plugin to record the current build state (source roots and artifacts)
 */
@Mojo(
    name = "record",
    requiresProject = true,
    threadSafe = false
)
class NxBuildStateRecordMojo : AbstractMojo() {

    private val log = LoggerFactory.getLogger(NxBuildStateRecordMojo::class.java)

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Recording build state for project: ${project.artifactId}")
        BuildStateRecorder.recordBuildState(project)
    }
}
