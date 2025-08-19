package com.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.lifecycle.Lifecycle
import org.apache.maven.lifecycle.mapping.LifecycleMapping
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
    
    // Maven lifecycle phases in order
    private val mavenPhases = listOf(
        "validate", "initialize", "generate-sources", "process-sources", 
        "generate-resources", "process-resources", "compile", "process-classes",
        "generate-test-sources", "process-test-sources", "generate-test-resources",
        "process-test-resources", "test-compile", "process-test-classes", "test",
        "prepare-package", "package", "pre-integration-test", "integration-test",
        "post-integration-test", "verify", "install", "deploy"
    )

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects for Nx integration...")
        
        try {
            val rootNode = objectMapper.createObjectNode()
            val projectsArray = objectMapper.createArrayNode()
            
            // Get all projects in the reactor
            val allProjects = session.allProjects
            log.info("Found ${allProjects.size} Maven projects")
            
            // First pass: create coordinates-to-project-name mapping
            val coordinatesToProjectName = mutableMapOf<String, String>()
            for (mavenProject in allProjects) {
                val coordinates = "${mavenProject.groupId}:${mavenProject.artifactId}"
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                coordinatesToProjectName[coordinates] = projectName
            }
            
            for (mavenProject in allProjects) {
                val projectNode = analyzeProject(mavenProject, coordinatesToProjectName, allProjects)
                if (projectNode != null) {
                    projectsArray.add(projectNode)
                }
            }
            
            rootNode.put("projects", projectsArray)
            
            // Add coordinates mapping to output
            val coordinatesMapping = objectMapper.createObjectNode()
            for ((coordinates, projectName) in coordinatesToProjectName) {
                coordinatesMapping.put(coordinates, projectName)
            }
            rootNode.put("coordinatesToProjectName", coordinatesMapping)
            rootNode.put("generatedAt", System.currentTimeMillis())
            rootNode.put("workspaceRoot", workspaceRoot)
            rootNode.put("totalProjects", allProjects.size)
            
            // Write JSON file
            val outputPath = if (outputFile.startsWith("/")) {
                // Absolute path
                File(outputFile)
            } else {
                // Relative path
                File(workspaceRoot, outputFile)
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
            
            log.info("Generated Nx project analysis: ${outputPath.absolutePath}")
            log.info("Analyzed ${allProjects.size} Maven projects")
            
        } catch (e: IOException) {
            throw MojoExecutionException("Failed to generate Nx project analysis", e)
        }
    }

    private fun analyzeProject(mavenProject: MavenProject, coordinatesToProjectName: Map<String, String>, allProjects: List<MavenProject>): ObjectNode? {
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
                // Include compile, provided, test, and null scope dependencies for build ordering
                if ("compile" == dependency.scope || "provided" == dependency.scope || "test" == dependency.scope || dependency.scope == null) {
                    val depNode = objectMapper.createObjectNode()
                    depNode.put("groupId", dependency.groupId)
                    depNode.put("artifactId", dependency.artifactId)
                    depNode.put("version", dependency.version)
                    depNode.put("scope", dependency.scope ?: "compile")
                    dependenciesArray.add(depNode)
                }
            }
            projectNode.put("dependencies", dependenciesArray)
            
            // Parent POM relationship
            val parent = mavenProject.parent
            if (parent != null) {
                val parentNode = objectMapper.createObjectNode()
                parentNode.put("groupId", parent.groupId)
                parentNode.put("artifactId", parent.artifactId)
                parentNode.put("version", parent.version)
                projectNode.put("parent", parentNode)
            }
            
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
            
            // Compute dependency relationships with phase resolution
            val dependencyRelationships = computeDependencyRelationships(
                mavenProject, coordinatesToProjectName, allProjects, lifecycleData
            )
            projectNode.put("dependencyRelationships", dependencyRelationships)
            
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
            // Get execution plans for all major Maven lifecycles
            val lifecyclePhases = listOf("deploy", "clean", "site")
            val allExecutionPlans = lifecyclePhases.mapNotNull { phase ->
                try {
                    lifecycleExecutor.calculateExecutionPlan(session, phase)
                } catch (e: Exception) {
                    log.debug("Could not calculate execution plan for phase: $phase", e)
                    null
                }
            }
            
            // Extract phases from all lifecycles
            val phasesArray = objectMapper.createArrayNode()
            val uniquePhases = mutableSetOf<String>()
            
            for (executionPlan in allExecutionPlans) {
                for (execution in executionPlan.mojoExecutions) {
                    execution.lifecyclePhase?.let { phase ->
                        if (!uniquePhases.contains(phase)) {
                            uniquePhases.add(phase)
                            phasesArray.add(phase)
                        }
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
            
            // Add common Maven phases based on packaging (including clean which is always available)
            val commonPhases = objectMapper.createArrayNode()
            
            // Clean is available for all project types
            commonPhases.add("clean")
            
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
    
    private fun getBestDependencyPhase(
        dependencyProjectName: String, 
        requestedPhase: String, 
        allProjects: List<MavenProject>
    ): String {
        // Find the dependency project's available phases
        val depProject = allProjects.find { "${it.groupId}.${it.artifactId}" == dependencyProjectName }
        if (depProject == null) {
            return requestedPhase // Fallback to requested phase if we can't find the project
        }
        
        // Get available phases from the project's lifecycle
        val availablePhases = mutableSetOf<String>()
        
        // Add common phases based on packaging
        when (depProject.packaging.lowercase()) {
            "jar", "war", "ear" -> {
                availablePhases.addAll(listOf("validate", "compile", "test", "package", "verify", "install", "deploy"))
            }
            "pom" -> {
                availablePhases.addAll(listOf("validate", "install", "deploy"))
            }
            "maven-plugin" -> {
                availablePhases.addAll(listOf("validate", "compile", "test", "package", "install", "deploy"))
            }
        }
        
        // Always add clean phase
        availablePhases.add("clean")
        
        val requestedPhaseIndex = mavenPhases.indexOf(requestedPhase)
        
        // If the requested phase is available, use it
        if (availablePhases.contains(requestedPhase)) {
            return requestedPhase
        }
        
        // Otherwise, find the highest available phase that comes before the requested phase
        if (requestedPhaseIndex > 0) {
            for (i in requestedPhaseIndex - 1 downTo 0) {
                if (availablePhases.contains(mavenPhases[i])) {
                    return mavenPhases[i]
                }
            }
        }
        
        // If no earlier phase is available, use the earliest available phase
        return availablePhases.minByOrNull { mavenPhases.indexOf(it) } ?: requestedPhase
    }
    
    private fun computeDependencyRelationships(
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>,
        lifecycleData: ObjectNode
    ): ObjectNode {
        val relationshipsNode = objectMapper.createObjectNode()
        
        // Get all available phases for this project
        val availablePhases = mutableSetOf<String>()
        
        // Add phases from lifecycle data
        val phasesNode = lifecycleData.get("phases")
        if (phasesNode != null && phasesNode.isArray) {
            for (phase in phasesNode) {
                availablePhases.add(phase.asText())
            }
        }
        
        // Add common phases
        val commonPhasesNode = lifecycleData.get("commonPhases")
        if (commonPhasesNode != null && commonPhasesNode.isArray) {
            for (phase in commonPhasesNode) {
                availablePhases.add(phase.asText())
            }
        }
        
        // For each available phase, compute the dependsOn relationships
        for (phase in availablePhases) {
            val dependsOnArray = objectMapper.createArrayNode()
            
            // Add parent dependency first (parent POMs must be installed before children)
            val parent = mavenProject.parent
            if (parent != null) {
                val parentCoordinates = "${parent.groupId}:${parent.artifactId}"
                val parentProjectName = coordinatesToProjectName[parentCoordinates]
                if (parentProjectName != null && parentProjectName != "${mavenProject.groupId}.${mavenProject.artifactId}") {
                    val bestPhase = getBestDependencyPhase(parentProjectName, phase, allProjects)
                    dependsOnArray.add("$parentProjectName:$bestPhase")
                }
            }
            
            // Add regular dependencies
            for (dependency in mavenProject.dependencies) {
                // Include compile, provided, test, and null scope dependencies for build ordering
                if (listOf("compile", "provided", "test", null).contains(dependency.scope)) {
                    val depCoordinates = "${dependency.groupId}:${dependency.artifactId}"
                    val depProjectName = coordinatesToProjectName[depCoordinates]
                    if (depProjectName != null && depProjectName != "${mavenProject.groupId}.${mavenProject.artifactId}") {
                        val bestPhase = getBestDependencyPhase(depProjectName, phase, allProjects)
                        dependsOnArray.add("$depProjectName:$bestPhase")
                    }
                }
            }
            
            relationshipsNode.put(phase, dependsOnArray)
        }
        
        return relationshipsNode
    }
}