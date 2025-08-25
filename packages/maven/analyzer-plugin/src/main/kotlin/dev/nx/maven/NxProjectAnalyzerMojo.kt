package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject

/**
 * Maven plugin to analyze project structure and generate JSON for Nx integration
 */
@Mojo(
    name = "analyze",
    defaultPhase = LifecyclePhase.VALIDATE,
    aggregator = true,
    requiresDependencyResolution = ResolutionScope.COMPILE_PLUS_RUNTIME
)
class NxProjectAnalyzerMojo : AbstractMojo() {

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var pluginManager: org.apache.maven.plugin.MavenPluginManager

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private lateinit var outputFile: String

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects using two-tier approach...")
        
        try {
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            // Step 1: Execute per-project analysis for all projects
            log.info("Step 1: Running per-project analysis...")
            executePerProjectAnalysis(allProjects)
            
            // Step 2: Generate workspace graph from individual analyses  
            log.info("Step 2: Generating workspace graph...")
            generateWorkspaceGraph(allProjects)
            
            log.info("Two-tier analysis completed successfully")
            
        } catch (e: Exception) {
            throw MojoExecutionException("Failed to execute two-tier Maven analysis", e)
        }
    }
    
    private fun executePerProjectAnalysis(allProjects: List<MavenProject>) {
        val singleAnalyzer = NxProjectAnalyzerSingleMojo()
        
        for (mavenProject in allProjects) {
            try {
                log.info("Analyzing project: ${mavenProject.artifactId}")
                
                // Set up the single project analyzer with current project context
                singleAnalyzer.setProject(mavenProject)
                singleAnalyzer.setSession(session)
                singleAnalyzer.setPluginManager(pluginManager)
                singleAnalyzer.setWorkspaceRoot(workspaceRoot)
                singleAnalyzer.setLog(log)
                
                // Execute single project analysis
                singleAnalyzer.execute()
                
            } catch (e: Exception) {
                log.warn("Failed to analyze project ${mavenProject.artifactId}: ${e.message}")
            }
        }
    }
    
    private fun generateWorkspaceGraph(allProjects: List<MavenProject>) {
        val graphGenerator = NxWorkspaceGraphMojo()
        
        // Set up the workspace graph generator
        graphGenerator.setSession(session)
        graphGenerator.setOutputFile(outputFile)
        graphGenerator.setWorkspaceRoot(workspaceRoot)
        graphGenerator.setLog(log)
        
        // Execute workspace graph generation
        graphGenerator.execute()
    }

}
