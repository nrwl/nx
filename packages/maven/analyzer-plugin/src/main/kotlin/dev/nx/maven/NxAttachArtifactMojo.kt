package dev.nx.maven

import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Maven plugin to attach artifacts to a project
 */
@Mojo(
    name = "attach-artifact",
    requiresProject = true,
    threadSafe = true
)
class NxAttachArtifactMojo : AbstractMojo() {

    private val log: Logger = LoggerFactory.getLogger(NxAttachArtifactMojo::class.java)

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var projectHelper: MavenProjectHelper

    @Parameter(property = "artifact", required = true)
    private lateinit var artifactPath: String

    @Parameter(property = "classifier", defaultValue = "")
    private var classifier: String = ""

    @Parameter(property = "type", defaultValue = "jar")
    private var type: String = "jar"

    @Parameter(property = "mainArtifact", defaultValue = "false")
    private var mainArtifact: Boolean = false

    @Throws(MojoExecutionException::class)
    override fun execute() {
        val artifactFile = File(artifactPath)

        if (!artifactFile.exists()) {
            throw MojoExecutionException("Artifact file does not exist: $artifactPath")
        }

        if (!artifactFile.isFile) {
            throw MojoExecutionException("Artifact path is not a file: $artifactPath")
        }

        log.info("Attaching artifact: ${artifactFile.absolutePath}")
        log.info("Classifier: $classifier")
        log.info("Type: $type")
        log.info("Main artifact: $mainArtifact")

        if (mainArtifact) {
            // Set as main project artifact
            project.artifact.file = artifactFile
            log.info("Successfully set main artifact for project ${project.artifactId}")
        } else if (classifier.isNotEmpty()) {
            // Attach as classified artifact
            projectHelper.attachArtifact(project, type, classifier, artifactFile)
            log.info("Successfully attached artifact with classifier '$classifier' to project ${project.artifactId}")
        } else {
            // Attach as additional artifact
            projectHelper.attachArtifact(project, type, artifactFile)
            log.info("Successfully attached artifact to project ${project.artifactId}")
        }
    }
}
