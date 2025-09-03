package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugin.MavenPluginManager
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

    @Component
    private lateinit var pluginManager: MavenPluginManager

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
                    } catch (e: Exception) {
                        log.warn("❌ Failed to parse analysis file for project '$projectName' at ${analysisFile.absolutePath}: ${e.message}")
                    }
                } else {
                    // Analysis file not found for project
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
                    }
                } else {
                    log.warn("Skipping project $projectName - no analysis available")
                }
            }
            
            // Generate final workspace graph
            val rootNode = objectMapper.createObjectNode()
            rootNode.put("createNodesResults", createNodesResults)
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
            val rawRoot = analysis.get("root")?.asText() ?: ""
            // Normalize empty root to '.'
            val root = if (rawRoot.isEmpty()) "." else rawRoot
            
            // Create project tuple [pom.xml path, config]  
            val projectTuple = objectMapper.createArrayNode()
            val pomPath = File(root, "pom.xml").path
            projectTuple.add(pomPath)
            
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
            
            // Generate targets from discovered plugin goals, organized by plugin
            val pluginGoalsNode = analysis.get("pluginGoals")
            if (pluginGoalsNode != null && pluginGoalsNode.isArray) {
                // Group goals by plugin for better organization
                val goalsByPlugin = mutableMapOf<String, MutableList<String>>()
                
                pluginGoalsNode.forEach { pluginGoalNode ->
                    val pluginGoal = pluginGoalNode.asText()
                    val parts = pluginGoal.split(":")
                    if (parts.size == 2) {
                        val originalPluginName = parts[0]
                        val goalName = parts[1]
                        val cleanPluginName = cleanPluginName(originalPluginName)
                        goalsByPlugin.getOrPut(cleanPluginName) { mutableListOf() }.add("$originalPluginName:$goalName")
                    }
                }
                
                // Process each plugin group
                goalsByPlugin.forEach { (cleanPluginName, pluginGoals) ->
                    log.info("Processing ${pluginGoals.size} goals for plugin '$cleanPluginName': ${pluginGoals.map { it.split(":")[1] }.joinToString(", ")}")
                    
                    pluginGoals.forEach { pluginGoal ->
                        val parts = pluginGoal.split(":")
                        val originalPluginName = parts[0]
                        val goalName = parts[1]
                        
                        // Create target for plugin goal using full plugin:goal naming
                        val target = objectMapper.createObjectNode()
                        target.put("executor", "nx:run-commands")
                        
                        val options = objectMapper.createObjectNode()
                        val cleanCommand = "mvn $cleanPluginName:$goalName -pl ${mavenProject.groupId}:${mavenProject.artifactId}"
                        options.put("command", cleanCommand)
                        options.put("cwd", "{workspaceRoot}")
                        target.put("options", options)
                        
                        // Plugin goals are typically not cacheable (like run) 
                        target.put("cache", false)
                        target.put("parallelism", false)
                        
                        // Add metadata to indicate plugin group
                        val metadata = objectMapper.createObjectNode()
                        metadata.put("plugin", cleanPluginName)
                        metadata.put("originalPlugin", originalPluginName)
                        metadata.put("goalName", goalName)
                        target.put("metadata", metadata)
                        
                        // Add dependsOn for plugin goal prerequisites (using original plugin name)
                        val goalDependencies = computeDependsOnForPluginGoal(pluginGoal, mavenProject)
                        if (goalDependencies.isNotEmpty()) {
                            val dependsOnArray = objectMapper.createArrayNode()
                            goalDependencies.forEach { dep -> dependsOnArray.add(dep) }
                            target.put("dependsOn", dependsOnArray)
                        }
                        
                        // Use clean plugin:goal naming convention
                        val targetName = "$cleanPluginName:$goalName"
                        targets.put(targetName, target)
                        
                        log.info("Generated Nx target '$targetName' for plugin goal '$pluginGoal' (group: $cleanPluginName)")
                    }
                }
            }
            
            // Remove test-related targets if project has no tests
            val hasTests = analysis.get("hasTests")?.asBoolean() ?: false
            if (!hasTests) {
                targets.remove("test")
                targets.remove("test-compile")
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
    
    /**
     * Cleans plugin names to remove unnecessary suffixes like "maven-plugin"
     */
    private fun cleanPluginName(pluginName: String): String {
        return pluginName
            .replace("-maven-plugin", "") // Remove standard Maven plugin suffix
            .replace("maven-", "") // Remove maven- prefix  
            .split(".")
            .last() // Take the last part after dots (e.g., org.springframework.boot -> boot)
            .let { name ->
                // Handle special cases for well-known plugins
                when (name) {
                    "spring-boot" -> "spring-boot"
                    "compiler" -> "compiler" 
                    "surefire" -> "surefire"
                    "failsafe" -> "failsafe"
                    else -> name
                }
            }
    }
    
    /**
     * Computes dependsOn targets for plugin goals based on Maven API prerequisites
     */
    private fun computeDependsOnForPluginGoal(pluginGoal: String, mavenProject: MavenProject): List<String> {
        try {
            val parts = pluginGoal.split(":")
            if (parts.size != 2) return emptyList()
            
            val pluginArtifactId = parts[0]  
            val goalName = parts[1]
            
            // Find the plugin in the project
            val plugin = findPluginInProject(pluginArtifactId, mavenProject) ?: return emptyList()
            
            // Load plugin descriptor to get mojo information
            val pluginDescriptor = pluginManager.getPluginDescriptor(plugin, mavenProject.remotePluginRepositories, session.repositorySession)
            val mojo = pluginDescriptor.getMojo(goalName) ?: return emptyList()
            
            val dependencies = mutableListOf<String>()
            
            // Check if mojo has a phase that should run before it
            val executePhase = mojo.executePhase
            if (!executePhase.isNullOrEmpty()) {
                dependencies.add(executePhase)
                log.debug("Plugin goal $pluginGoal requires phase: $executePhase")
            }
            
            // Check dependency resolution requirements
            val dependencyResolution = mojo.dependencyResolutionRequired
            when (dependencyResolution) {
                "compile" -> dependencies.add("compile")
                "test" -> dependencies.add("test-compile")
                "runtime" -> dependencies.add("compile") 
                "test-compile" -> dependencies.add("test-compile")
                "compile+runtime", "compile_plus_runtime" -> dependencies.add("compile")
                "runtime+system" -> dependencies.add("compile")
            }
            
            return dependencies.distinct()
            
        } catch (e: Exception) {
            log.debug("Could not compute dependencies for plugin goal $pluginGoal: ${e.message}")
            return emptyList()
        }
    }
    
    /**
     * Finds a plugin in the project by artifact ID
     */
    private fun findPluginInProject(pluginArtifactId: String, mavenProject: MavenProject): org.apache.maven.model.Plugin? {
        // Check build plugins
        mavenProject.build?.plugins?.find { it.artifactId == pluginArtifactId }?.let { return it }
        
        // Check plugin management
        mavenProject.build?.pluginManagement?.plugins?.find { it.artifactId == pluginArtifactId }?.let { return it }
        
        // Check parent projects
        var currentProject: MavenProject? = mavenProject
        while (currentProject?.parent != null) {
            currentProject = currentProject.parent
            currentProject.build?.plugins?.find { it.artifactId == pluginArtifactId }?.let { return it }
            currentProject.build?.pluginManagement?.plugins?.find { it.artifactId == pluginArtifactId }?.let { return it }
        }
        
        return null
    }
}