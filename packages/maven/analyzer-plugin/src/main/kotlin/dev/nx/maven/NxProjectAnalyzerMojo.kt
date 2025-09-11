package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
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
    requiresDependencyResolution = ResolutionScope.NONE
)
class NxProjectAnalyzerMojo : AbstractMojo() {

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var pluginManager: org.apache.maven.plugin.MavenPluginManager

    @Component
    private lateinit var lifecycleExecutor: LifecycleExecutor

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private lateinit var outputFile: String

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects using optimized two-tier approach...")
        
        try {
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            // Step 1: Execute per-project analysis for all projects (in-memory)
            log.info("Step 1: Running optimized per-project analysis...")
            val inMemoryAnalyses = executePerProjectAnalysisInMemory(allProjects)
            
            // Step 2: Generate workspace graph from in-memory analyses  
            log.info("Step 2: Generating workspace graph from in-memory analyses...")
            generateWorkspaceGraphFromMemory(allProjects, inMemoryAnalyses)
            
            log.info("Optimized two-tier analysis completed successfully")
            
        } catch (e: Exception) {
            throw MojoExecutionException("Failed to execute optimized two-tier Maven analysis", e)
        }
    }
    
    private fun executePerProjectAnalysisInMemory(allProjects: List<MavenProject>): Map<String, JsonNode> {
        val startTime = System.currentTimeMillis()
        log.info("Creating shared component instances for optimized analysis...")
        
        // Create shared component instances ONCE for all projects (major optimization)
        val objectMapper = ObjectMapper()
        val sharedInputOutputAnalyzer = MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, session, pluginManager, lifecycleExecutor
        )
        val sharedLifecycleAnalyzer = MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log, pluginManager)
        val sharedTestClassDiscovery = TestClassDiscovery()
        
        val setupTime = System.currentTimeMillis() - startTime
        log.info("Shared components created in ${setupTime}ms, analyzing ${allProjects.size} projects...")
        
        val singleAnalyzer = NxProjectAnalyzerSingleMojo(
            session,
            pluginManager,
            lifecycleExecutor,
            workspaceRoot,
            sharedInputOutputAnalyzer,
            sharedLifecycleAnalyzer,
            sharedTestClassDiscovery
        )
        singleAnalyzer.setLog(log)
        
        // Collect analyses in memory instead of writing to files
        val inMemoryAnalyses = mutableMapOf<String, JsonNode>()
        
        val projectStartTime = System.currentTimeMillis()
        for (mavenProject in allProjects) {
            try {
                log.info("Analyzing project: ${mavenProject.artifactId}")
                
                // Only set the project context (no expensive component recreation)
                singleAnalyzer.setProject(mavenProject)
                
                // Get analysis directly without writing to file
                val analysis = singleAnalyzer.analyzeProjectInMemory()
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                inMemoryAnalyses[projectName] = analysis
                
            } catch (e: Exception) {
                log.warn("Failed to analyze project ${mavenProject.artifactId}: ${e.message}")
            }
        }
        
        val totalTime = System.currentTimeMillis() - startTime
        val analysisTime = System.currentTimeMillis() - projectStartTime
        log.info("Completed in-memory analysis of ${allProjects.size} projects in ${totalTime}ms (setup: ${setupTime}ms, analysis: ${analysisTime}ms)")
        
        return inMemoryAnalyses
    }
    
    private fun generateWorkspaceGraphFromMemory(allProjects: List<MavenProject>, inMemoryAnalyses: Map<String, JsonNode>) {
        val graphGenerator = NxWorkspaceGraphMojo()
        
        // Set up the workspace graph generator
        graphGenerator.setSession(session)
        graphGenerator.setOutputFile(outputFile)
        graphGenerator.setWorkspaceRoot(workspaceRoot)
        graphGenerator.setLog(log)
        
        // Pass in-memory analyses (optimization)
        graphGenerator.setInMemoryProjectAnalyses(inMemoryAnalyses)
        
        // Execute workspace graph generation with in-memory data
        graphGenerator.execute()
    }
    

}
