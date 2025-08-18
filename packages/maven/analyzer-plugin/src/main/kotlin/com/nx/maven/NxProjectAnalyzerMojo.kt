package com.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.model.Dependency
import org.apache.maven.model.Plugin
import org.apache.maven.model.PluginExecution
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import java.io.File
import java.io.IOException
import java.nio.file.Paths

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
    private lateinit var lifecycleExecutor: LifecycleExecutor

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private lateinit var outputFile: String

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    private val objectMapper = ObjectMapper()

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects for Nx integration...")
        
        try {
            val rootNode = objectMapper.createObjectNode()
            val projectsArray = objectMapper.createArrayNode()
            
            // Get all projects in the reactor
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            for (mavenProject in allProjects) {
                val projectNode = analyzeProject(mavenProject)
                if (projectNode != null) {
                    projectsArray.add(projectNode)
                }
            }
            
            rootNode.put("projects", projectsArray)
            rootNode.put("generatedAt", System.currentTimeMillis())
            rootNode.put("workspaceRoot", workspaceRoot)
            rootNode.put("totalProjects", allProjects.size)
            
            // Write JSON file
            val outputPath = File(workspaceRoot, outputFile)
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
            
            log.info("Generated Nx project analysis: ${outputPath.absolutePath}")
            log.info("Analyzed ${allProjects.size} Maven projects")
            
        } catch (e: IOException) {
            throw MojoExecutionException("Failed to generate Nx project analysis", e)
        }
    }

    private fun analyzeProject(mavenProject: MavenProject): ObjectNode? {
        return try {
            val projectNode = objectMapper.createObjectNode()
            
            // Basic project information
            projectNode.put("artifactId", mavenProject.artifactId)
            projectNode.put("groupId", mavenProject.groupId)
            projectNode.put("version", mavenProject.version)
            projectNode.put("packaging", mavenProject.packaging)
            projectNode.put("name", mavenProject.name)
            projectNode.put("description", mavenProject.description ?: "")
            
            // Calculate relative path from workspace root
            val workspaceRootPath = Paths.get(workspaceRoot)
            val projectPath = mavenProject.basedir.toPath()
            val relativePath = workspaceRootPath.relativize(projectPath).toString().replace("\\", "/")
            projectNode.put("root", relativePath)
            
            // Project type based on packaging
            val projectType = determineProjectType(mavenProject.packaging)
            projectNode.put("projectType", projectType)
            
            // Source root
            val sourceRoot = "$relativePath/src/main/java"
            projectNode.put("sourceRoot", sourceRoot)
            
            // Dependencies
            val dependenciesArray = objectMapper.createArrayNode()
            for (dependency in mavenProject.dependencies) {
                if ("compile" == dependency.scope || dependency.scope == null) {
                    val depNode = objectMapper.createObjectNode()
                    depNode.put("groupId", dependency.groupId)
                    depNode.put("artifactId", dependency.artifactId)
                    depNode.put("version", dependency.version)
                    depNode.put("scope", dependency.scope ?: "compile")
                    dependenciesArray.add(depNode)
                }
            }
            projectNode.put("dependencies", dependenciesArray)
            
            // Tags
            val tagsArray = objectMapper.createArrayNode()
            tagsArray.add("maven:${mavenProject.groupId}")
            tagsArray.add("maven:${mavenProject.packaging}")
            if (mavenProject.packaging == "maven-plugin") {
                tagsArray.add("maven:plugin")
            }
            projectNode.put("tags", tagsArray)
            
            // Modules (for parent POMs)
            if (mavenProject.modules?.isNotEmpty() == true) {
                val modules = mavenProject.modules
                val modulesArray = objectMapper.createArrayNode()
                for (module in modules) {
                    modulesArray.add(module)
                }
                projectNode.put("modules", modulesArray)
            }
            
            // Check if project has tests
            val testDir = File(mavenProject.basedir, "src/test/java")
            projectNode.put("hasTests", testDir.exists() && testDir.isDirectory)
            
            // Check if project has resources
            val resourcesDir = File(mavenProject.basedir, "src/main/resources")
            projectNode.put("hasResources", resourcesDir.exists() && resourcesDir.isDirectory)
            
            // Extract lifecycle phases and plugin goals
            val lifecycleData = extractLifecycleData(mavenProject)
            projectNode.put("lifecycle", lifecycleData)
            
            log.debug("Analyzed project: ${mavenProject.artifactId} at $relativePath")
            
            projectNode
            
        } catch (e: Exception) {
            log.warn("Failed to analyze project: ${mavenProject.artifactId}", e)
            null
        }
    }
    
    private fun determineProjectType(packaging: String): String {
        return when (packaging.lowercase()) {
            "pom" -> "library"
            "jar", "war", "ear" -> "application"
            "maven-plugin" -> "library"
            else -> "library"
        }
    }
    
    private fun extractLifecycleData(mavenProject: MavenProject): ObjectNode {
        val lifecycleNode = objectMapper.createObjectNode()
        
        try {
            // Get the execution plan for the default lifecycle
            val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, "deploy")
            
            // Extract phases
            val phasesArray = objectMapper.createArrayNode()
            val uniquePhases = mutableSetOf<String>()
            
            for (execution in executionPlan.mojoExecutions) {
                execution.lifecyclePhase?.let { phase ->
                    if (!uniquePhases.contains(phase)) {
                        uniquePhases.add(phase)
                        phasesArray.add(phase)
                    }
                }
            }
            lifecycleNode.put("phases", phasesArray)
            
            // Extract plugin goals and their configurations
            val goalsArray = objectMapper.createArrayNode()
            val pluginsArray = objectMapper.createArrayNode()
            
            // Process build plugins
            mavenProject.build?.plugins?.let { plugins ->
                for (plugin in plugins) {
                    val pluginNode = objectMapper.createObjectNode()
                    pluginNode.put("groupId", plugin.groupId)
                    pluginNode.put("artifactId", plugin.artifactId)
                    pluginNode.put("version", plugin.version)
                    
                    // Plugin executions with goals
                    val executionsArray = objectMapper.createArrayNode()
                    plugin.executions?.let { executions ->
                        for (execution in executions) {
                            val executionNode = objectMapper.createObjectNode()
                            executionNode.put("id", execution.id)
                            executionNode.put("phase", execution.phase)
                            
                            val goalsList = objectMapper.createArrayNode()
                            for (goal in execution.goals) {
                                goalsList.add(goal)
                                // Add to global goals list
                                val goalNode = objectMapper.createObjectNode()
                                goalNode.put("plugin", plugin.artifactId)
                                goalNode.put("goal", goal)
                                goalNode.put("phase", execution.phase)
                                goalsArray.add(goalNode)
                            }
                            executionNode.put("goals", goalsList)
                            executionsArray.add(executionNode)
                        }
                    }
                    pluginNode.put("executions", executionsArray)
                    pluginsArray.add(pluginNode)
                }
            }
            
            lifecycleNode.put("goals", goalsArray)
            lifecycleNode.put("plugins", pluginsArray)
            
            // Add common Maven phases based on packaging
            val commonPhases = objectMapper.createArrayNode()
            when (mavenProject.packaging.lowercase()) {
                "jar", "war", "ear" -> {
                    commonPhases.add("validate")
                    commonPhases.add("compile")
                    commonPhases.add("test")
                    commonPhases.add("package")
                    commonPhases.add("verify")
                    commonPhases.add("install")
                    commonPhases.add("deploy")
                }
                "pom" -> {
                    commonPhases.add("validate")
                    commonPhases.add("install")
                    commonPhases.add("deploy")
                }
                "maven-plugin" -> {
                    commonPhases.add("validate")
                    commonPhases.add("compile")
                    commonPhases.add("test")
                    commonPhases.add("package")
                    commonPhases.add("install")
                    commonPhases.add("deploy")
                }
            }
            lifecycleNode.put("commonPhases", commonPhases)
            
        } catch (e: Exception) {
            log.warn("Failed to extract lifecycle data for project: ${mavenProject.artifactId}", e)
            // Return minimal lifecycle data
            val fallbackPhases = objectMapper.createArrayNode()
            fallbackPhases.add("compile")
            fallbackPhases.add("test")
            fallbackPhases.add("package")
            fallbackPhases.add("clean")
            lifecycleNode.put("commonPhases", fallbackPhases)
        }
        
        return lifecycleNode
    }
}