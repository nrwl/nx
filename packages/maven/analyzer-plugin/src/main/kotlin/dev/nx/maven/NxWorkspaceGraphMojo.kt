package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import java.io.File
import java.io.IOException

/**
 * Maven plugin to merge individual project analyses into a complete workspace graph
 * This runs after all individual project analyses are complete
 */
@Mojo(
    name = "analyze-graph",
    defaultPhase = LifecyclePhase.VALIDATE,
    aggregator = true,
    requiresDependencyResolution = ResolutionScope.NONE
)
class NxWorkspaceGraphMojo : AbstractMojo() {

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private lateinit var outputFile: String

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    private val objectMapper = ObjectMapper()
    private val dependencyResolver = MavenDependencyResolver()
    
    // Setters for orchestrated execution
    fun setSession(session: MavenSession) {
        this.session = session
    }
    
    fun setOutputFile(outputFile: String) {
        this.outputFile = outputFile
    }
    
    fun setWorkspaceRoot(workspaceRoot: String) {
        this.workspaceRoot = workspaceRoot
    }

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Merging individual project analyses into workspace graph...")
        
        try {
            val allProjects = session.allProjects
            log.info("Processing ${allProjects.size} Maven projects")
            
            // Collect individual project analyses
            val projectAnalyses = mutableMapOf<String, JsonNode>()
            val coordinatesToProjectName = mutableMapOf<String, String>()
            
            // First pass: load individual analyses and build coordinate mapping
            for (mavenProject in allProjects) {
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                val coordinates = "${mavenProject.groupId}:${mavenProject.artifactId}"
                coordinatesToProjectName[coordinates] = projectName
                
                // Try to load individual project analysis
                val analysisFile = File(mavenProject.build.directory, "nx-project-analysis.json")
                if (analysisFile.exists()) {
                    try {
                        val analysis = objectMapper.readTree(analysisFile)
                        projectAnalyses[projectName] = analysis
                        log.debug("Loaded analysis for project: $projectName")
                    } catch (e: Exception) {
                        log.warn("Failed to load analysis for project $projectName: ${e.message}")
                    }
                } else {
                    log.warn("No analysis file found for project $projectName at ${analysisFile.absolutePath}")
                }
            }
            
            // Second pass: resolve dependencies and generate complete Nx configurations
            val createNodesResults = objectMapper.createArrayNode()
            
            for (mavenProject in allProjects) {
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                val analysis = projectAnalyses[projectName]
                
                if (analysis != null) {
                    // Generate Nx configuration with cross-project dependency resolution
                    val nxConfig = generateNxConfigFromAnalysis(
                        analysis, mavenProject, coordinatesToProjectName, allProjects
                    )
                    if (nxConfig != null) {
                        createNodesResults.add(nxConfig)
                        log.debug("Generated Nx config for project: $projectName")
                    }
                } else {
                    log.warn("Skipping project $projectName - no analysis available")
                }
            }
            
            // Generate final workspace graph
            val rootNode = objectMapper.createObjectNode()
            rootNode.put("createNodesResults", createNodesResults)
            rootNode.put("generatedAt", System.currentTimeMillis())
            rootNode.put("workspaceRoot", workspaceRoot)
            rootNode.put("totalProjects", allProjects.size)
            rootNode.put("analyzedProjects", projectAnalyses.size)
            rootNode.put("analysisMethod", "two-tier")
            
            // Write workspace graph
            val outputPath = if (outputFile.startsWith("/")) {
                File(outputFile)
            } else {
                File(workspaceRoot, outputFile)
            }
            
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
            
            log.info("Generated workspace graph: ${outputPath.absolutePath}")
            log.info("Merged ${projectAnalyses.size}/${allProjects.size} project analyses")
            
        } catch (e: IOException) {
            throw MojoExecutionException("Failed to generate workspace graph", e)
        }
    }

    private fun generateNxConfigFromAnalysis(
        analysis: JsonNode,
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>
    ): ArrayNode? {
        try {
            val projectName = analysis.get("projectName")?.asText() 
                ?: "${mavenProject.groupId}.${mavenProject.artifactId}"
            val root = analysis.get("root")?.asText() ?: ""
            
            // Create project tuple [root, config]
            val projectTuple = objectMapper.createArrayNode()
            projectTuple.add(root)
            
            val projectConfig = objectMapper.createObjectNode()
            val projects = objectMapper.createObjectNode()
            val project = objectMapper.createObjectNode()
            
            // Basic project info from analysis
            project.put("name", projectName)
            project.put("root", root)
            project.put("projectType", analysis.get("projectType")?.asText() ?: "library")
            project.put("sourceRoot", "${root}/src/main/java")
            
            // Generate targets from phase analysis
            val targets = objectMapper.createObjectNode()
            val phasesNode = analysis.get("phases")
            
            if (phasesNode != null && phasesNode.isObject) {
                phasesNode.fields().forEach { (phase, phaseAnalysis) ->
                    val target = objectMapper.createObjectNode()
                    target.put("executor", "nx:run-commands")
                    
                    val options = objectMapper.createObjectNode()
                    options.put("command", "mvn $phase -pl ${mavenProject.groupId}:${mavenProject.artifactId}")
                    options.put("cwd", "{workspaceRoot}")
                    target.put("options", options)
                    
                    // Add dependency resolution
                    val dependsOn = dependencyResolver.computeDependsOnForPhase(
                        phase, mavenProject, coordinatesToProjectName, allProjects
                    )
                    if (dependsOn.isNotEmpty()) {
                        val dependsOnArray = objectMapper.createArrayNode()
                        dependsOn.forEach { dep -> dependsOnArray.add(dep) }
                        target.put("dependsOn", dependsOnArray)
                    }
                    
                    // Copy caching info from analysis
                    if (phaseAnalysis.get("cacheable")?.asBoolean() == true) {
                        target.put("cache", true)
                        target.put("inputs", phaseAnalysis.get("inputs"))
                        target.put("outputs", phaseAnalysis.get("outputs"))
                    } else {
                        target.put("cache", false)
                    }
                    
                    target.put("parallelism", true)
                    targets.put(phase, target)
                }
            }
            
            // Add clean target (always uncached)
            val cleanTarget = objectMapper.createObjectNode()
            cleanTarget.put("executor", "nx:run-commands")
            val cleanOptions = objectMapper.createObjectNode()
            cleanOptions.put("command", "mvn clean -pl ${mavenProject.groupId}:${mavenProject.artifactId}")
            cleanOptions.put("cwd", "{workspaceRoot}")
            cleanTarget.put("options", cleanOptions)
            cleanTarget.put("cache", false)
            cleanTarget.put("parallelism", true)
            targets.put("clean", cleanTarget)
            
            project.put("targets", targets)
            
            // Tags
            val tags = objectMapper.createArrayNode()
            tags.add("maven:${mavenProject.groupId}")
            tags.add("maven:${mavenProject.packaging}")
            project.put("tags", tags)
            
            projects.put(root, project)
            projectConfig.put("projects", projects)
            projectTuple.add(projectConfig)
            
            return projectTuple
            
        } catch (e: Exception) {
            log.error("Failed to generate Nx config for project ${mavenProject.artifactId}: ${e.message}", e)
            return null
        }
    }
}