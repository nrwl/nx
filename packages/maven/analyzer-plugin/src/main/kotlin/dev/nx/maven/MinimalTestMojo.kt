package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject

/**
 * Minimal test mojo to isolate the StackOverflowError
 */
@Mojo(
    name = "minimal-test",
    defaultPhase = LifecyclePhase.VALIDATE,
    aggregator = true,
    requiresDependencyResolution = ResolutionScope.NONE
)
class MinimalTestMojo : AbstractMojo() {

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Starting minimal test...")
        
        try {
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            for (mavenProject in allProjects) {
                log.info("Testing project: ${mavenProject.artifactId}")
                
                // Just basic project info - no complex processing
                log.info("  - Group: ${mavenProject.groupId}")
                log.info("  - Version: ${mavenProject.version}")
                log.info("  - BaseDir: ${mavenProject.basedir}")
                
                // Test if this is causing issues
                if (mavenProject.name != null) {
                    log.info("  - Name: ${mavenProject.name}")
                }
            }
            
            log.info("Minimal test completed successfully")
            
        } catch (e: Exception) {
            log.error("Minimal test failed: ${e.message}", e)
            throw MojoExecutionException("Failed to execute minimal test", e)
        }
    }
}