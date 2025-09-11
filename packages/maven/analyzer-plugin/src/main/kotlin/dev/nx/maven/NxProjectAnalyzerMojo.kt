package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import java.io.File

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
    
    private val objectMapper = ObjectMapper()
    
    // Shared components for target generation
    private var sharedInputOutputAnalyzer: MavenInputOutputAnalyzer? = null
    private var sharedLifecycleAnalyzer: MavenLifecycleAnalyzer? = null
    private var sharedTestClassDiscovery: TestClassDiscovery? = null

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects using optimized two-tier approach...")
        
        try {
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            // Step 1: Execute per-project analysis for all projects (in-memory)
            log.info("Step 1: Running optimized per-project analysis...")
            val inMemoryAnalyses = executePerProjectAnalysisInMemory(allProjects)
            
            // Step 2: Write project analyses to output file
            log.info("Step 2: Writing project analyses to output file...")
            writeProjectAnalysesToFile(inMemoryAnalyses)
            
            log.info("Optimized two-tier analysis completed successfully")
            
        } catch (e: Exception) {
            throw MojoExecutionException("Failed to execute optimized two-tier Maven analysis", e)
        }
    }
    
    private fun executePerProjectAnalysisInMemory(allProjects: List<MavenProject>): Map<String, JsonNode> {
        val startTime = System.currentTimeMillis()
        log.info("Creating shared component instances for optimized analysis...")
        
        // Create shared component instances ONCE for all projects (major optimization)
        sharedInputOutputAnalyzer = MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, session, pluginManager, lifecycleExecutor
        )
        sharedLifecycleAnalyzer = MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log, pluginManager)
        sharedTestClassDiscovery = TestClassDiscovery()
        
        val setupTime = System.currentTimeMillis() - startTime
        log.info("Shared components created in ${setupTime}ms, analyzing ${allProjects.size} projects...")
        
        val projectStartTime = System.currentTimeMillis()
        
        // Process projects in parallel with separate analyzer instances
        val inMemoryAnalyses = allProjects.parallelStream().map { mavenProject ->
            try {
                log.info("Analyzing project: ${mavenProject.artifactId}")
                
                // Create separate analyzer instance for each project (thread-safe)
                val singleAnalyzer = NxProjectAnalyzer(
                    session,
                    mavenProject,
                    pluginManager,
                    lifecycleExecutor,
                    workspaceRoot,
                    log,
                    sharedInputOutputAnalyzer!!,
                    sharedLifecycleAnalyzer!!,
                    sharedTestClassDiscovery!!
                )
                
                // Get analysis directly without writing to file
                val analysis = singleAnalyzer.analyze()
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                
                projectName to analysis
                
            } catch (e: Exception) {
                log.warn("Failed to analyze project ${mavenProject.artifactId}: ${e.message}")
                null
            }
        }.collect(java.util.stream.Collectors.toList()).filterNotNull().toMap()
        
        val totalTime = System.currentTimeMillis() - startTime
        val analysisTime = System.currentTimeMillis() - projectStartTime
        log.info("Completed in-memory analysis of ${allProjects.size} projects in ${totalTime}ms (setup: ${setupTime}ms, analysis: ${analysisTime}ms)")
        
        return inMemoryAnalyses
    }
    
    private fun writeProjectAnalysesToFile(inMemoryAnalyses: Map<String, JsonNode>) {
        val outputPath = if (outputFile.startsWith("/")) {
            File(outputFile)
        } else {
            File(workspaceRoot, outputFile)
        }
        
        // Ensure parent directory exists
        outputPath.parentFile?.mkdirs()
        
        // Create JSON structure with both project analyses and createNodesResults
        val rootNode = objectMapper.createObjectNode()
        val projectsNode = objectMapper.createObjectNode()
        
        // Add project analyses
        inMemoryAnalyses.forEach { (projectName, analysis) ->
            projectsNode.set<JsonNode>(projectName, analysis)
        }
        rootNode.set<JsonNode>("projects", projectsNode)
        
        // Generate createNodesResults for Nx plugin consumption
        val createNodesResults = generateCreateNodesResults(inMemoryAnalyses)
        rootNode.set<JsonNode>("createNodesResults", createNodesResults)
        
        // Add metadata
        rootNode.put("totalProjects", inMemoryAnalyses.size)
        rootNode.put("workspaceRoot", workspaceRoot)
        rootNode.put("analysisMethod", "optimized-parallel")
        rootNode.put("analyzedProjects", inMemoryAnalyses.size)
        
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
        log.info("Generated project analyses with ${inMemoryAnalyses.size} projects: ${outputPath.absolutePath}")
    }
    
    private fun generateCreateNodesResults(inMemoryAnalyses: Map<String, JsonNode>): com.fasterxml.jackson.databind.node.ArrayNode {
        val createNodesResults = objectMapper.createArrayNode()
        
        // Group projects by root directory (for now, assume all projects are at workspace root)
        val projects = objectMapper.createObjectNode()
        
        inMemoryAnalyses.forEach { (projectName, analysis) ->
            try {
                // Find the corresponding Maven project
                val mavenProject = session.allProjects.find { "${it.groupId}.${it.artifactId}" == projectName }
                if (mavenProject == null) {
                    log.warn("Could not find Maven project for $projectName")
                    return@forEach
                }
                
                // Create analyzer instance to generate Nx project config
                val analyzer = NxProjectAnalyzer(
                    session,
                    mavenProject,
                    pluginManager,
                    lifecycleExecutor,
                    workspaceRoot,
                    log,
                    sharedInputOutputAnalyzer!!,
                    sharedLifecycleAnalyzer!!,
                    sharedTestClassDiscovery!!
                )
                
                val nxProjectConfig = analyzer.generateNxProjectConfig()
                if (nxProjectConfig != null) {
                    val (root, projectConfig) = nxProjectConfig
                    projects.set<JsonNode>(root, projectConfig)
                }
            } catch (e: Exception) {
                log.warn("Failed to generate Nx config for project $projectName: ${e.message}")
            }
        }
        
        // Create the createNodesResults structure: [root, {projects: {...}}]
        val resultTuple = objectMapper.createArrayNode()
        resultTuple.add("") // Root path (workspace root)
        val projectsWrapper = objectMapper.createObjectNode()
        projectsWrapper.set<JsonNode>("projects", projects)
        resultTuple.add(projectsWrapper)
        
        createNodesResults.add(resultTuple)
        return createNodesResults
    }
    

}
