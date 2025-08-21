package dev.nx.maven

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

    @Component
    private lateinit var pluginManager: org.apache.maven.plugin.PluginManager

    @Parameter(property = "nx.outputFile", defaultValue = "nx-maven-projects.json")
    private lateinit var outputFile: String

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    private val objectMapper = ObjectMapper()
    private val dependencyResolver = MavenDependencyResolver()
    private lateinit var lifecycleAnalyzer: MavenLifecycleAnalyzer
    private lateinit var nxConfigGenerator: NxProjectConfigurationGenerator

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects for Nx integration...")
        
        // Initialize analyzers
        lifecycleAnalyzer = MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log)
        nxConfigGenerator = NxProjectConfigurationGenerator(objectMapper, dependencyResolver, workspaceRoot, log, session, lifecycleExecutor, pluginManager)
        
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
            
            // Generate Nx-format createNodesResults
            val createNodesResults = objectMapper.createArrayNode()
            for (mavenProject in allProjects) {
                val nxProjectConfig = nxConfigGenerator.generateNxProjectConfiguration(mavenProject, coordinatesToProjectName, allProjects)
                if (nxProjectConfig != null) {
                    createNodesResults.add(nxProjectConfig)
                }
            }
            
            rootNode.put("createNodesResults", createNodesResults)
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
            val lifecycleData = lifecycleAnalyzer.extractLifecycleData(mavenProject)
            projectNode.put("lifecycle", lifecycleData)
            
            // Compute dependency relationships with phase resolution (now deprecated, using Nx format instead)
            // val dependencyRelationships = dependencyResolver.computeDependencyRelationships(...)
            // projectNode.put("dependencyRelationships", dependencyRelationships)
            
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
}
