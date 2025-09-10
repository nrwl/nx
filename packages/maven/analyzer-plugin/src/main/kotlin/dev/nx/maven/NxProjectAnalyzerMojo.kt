package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import java.io.File
import java.io.IOException
import java.nio.file.Paths

/**
 * Maven plugin to analyze project structure and generate JSON for Nx integration
 * Single-pass in-memory analysis for optimal performance
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
    private val dependencyResolver = MavenDependencyResolver()

    @Throws(MojoExecutionException::class)
    override fun execute() {
        val startTime = System.currentTimeMillis()
        
        try {
            val allProjects = collectProjectsFromModules(session.topLevelProject)
            
            // Single-pass analysis: analyze all projects in memory
            val projectAnalyses = mutableMapOf<String, ObjectNode>()
            val coordinatesToProjectName = mutableMapOf<String, String>()
            
            // Build coordinate mapping first
            for (mavenProject in allProjects) {
                val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                val coordinates = "${mavenProject.groupId}:${mavenProject.artifactId}"
                coordinatesToProjectName[coordinates] = projectName
            }
            
            // Analyze all projects in memory
            for (mavenProject in allProjects) {
                try {
                    val projectName = "${mavenProject.groupId}.${mavenProject.artifactId}"
                    projectAnalyses[projectName] = analyzeSingleProject(mavenProject)
                } catch (e: Exception) {
                    log.warn("Failed to analyze project ${mavenProject.artifactId}: ${e.message}")
                }
            }
            
            // Generate Nx configurations with dependency resolution
            val createNodesResults = generateNxConfigurations(projectAnalyses, coordinatesToProjectName, allProjects)
            
            // Generate final workspace graph
            val rootNode = objectMapper.createObjectNode()
            rootNode.put("createNodesResults", createNodesResults)
            rootNode.put("workspaceRoot", workspaceRoot)
            rootNode.put("totalProjects", allProjects.size)
            rootNode.put("analyzedProjects", projectAnalyses.size)
            rootNode.put("analysisMethod", "single-pass")
            
            // Write final result once
            val outputPath = if (outputFile.startsWith("/")) {
                File(outputFile)
            } else {
                File(workspaceRoot, outputFile)
            }
            
            outputPath.parentFile?.mkdirs()
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
            
            val duration = System.currentTimeMillis() - startTime
            log.info("Analyzed ${projectAnalyses.size}/${allProjects.size} projects in ${duration}ms: ${outputPath.absolutePath}")
            
        } catch (e: IOException) {
            throw MojoExecutionException("Failed to generate single-pass Maven analysis", e)
        }
    }
    
    private fun collectProjectsFromModules(rootProject: MavenProject): List<MavenProject> {
        val allProjects = mutableListOf<MavenProject>()
        collectProjectsRecursively(rootProject, allProjects)
        return allProjects
    }
    
    private fun collectProjectsRecursively(project: MavenProject, projects: MutableList<MavenProject>) {
        projects.add(project)
        project.collectedProjects?.forEach { child ->
            collectProjectsRecursively(child as MavenProject, projects)
        }
    }
    
    private fun analyzeSingleProject(mavenProject: MavenProject): ObjectNode {
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
        val relativePath = workspaceRootPath.relativize(projectPath).toString().replace('\\', '/')
        projectNode.put("root", relativePath)
        
        // Project type based on packaging
        val projectType = determineProjectType(mavenProject.packaging)
        projectNode.put("projectType", projectType)
        
        // Source roots
        val sourceRoots = objectMapper.createArrayNode()
        mavenProject.compileSourceRoots?.forEach { sourceRoot ->
            val relativeSourceRoot = workspaceRootPath.relativize(Paths.get(sourceRoot)).toString().replace('\\', '/')
            sourceRoots.add(relativeSourceRoot)
        }
        projectNode.put("sourceRoots", sourceRoots)
        
        // Test source roots  
        val testSourceRoots = objectMapper.createArrayNode()
        mavenProject.testCompileSourceRoots?.forEach { testSourceRoot ->
            val relativeTestRoot = workspaceRootPath.relativize(Paths.get(testSourceRoot)).toString().replace('\\', '/')
            testSourceRoots.add(relativeTestRoot)
        }
        projectNode.put("testSourceRoots", testSourceRoots)
        
        // Dependencies (as coordinates - workspace resolution handled later)
        val dependenciesArray = objectMapper.createArrayNode()
        for (dependency in mavenProject.dependencies) {
            if (listOf("compile", "provided", "test", null).contains(dependency.scope)) {
                val depNode = objectMapper.createObjectNode()
                depNode.put("groupId", dependency.groupId)
                depNode.put("artifactId", dependency.artifactId)
                depNode.put("version", dependency.version)
                depNode.put("scope", dependency.scope ?: "compile")
                depNode.put("coordinates", "${dependency.groupId}:${dependency.artifactId}")
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
            parentNode.put("coordinates", "${parent.groupId}:${parent.artifactId}")
            projectNode.put("parent", parentNode)
        }
        
        // Lightweight lifecycle analysis (essential phases only)
        val phases = objectMapper.createObjectNode()
        val essentialPhases = listOf("validate", "compile", "test-compile", "test", "package", "verify", "clean")
        
        val inputOutputAnalyzer = MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, session, pluginManager, lifecycleExecutor
        )
        
        essentialPhases.forEach { phase ->
            try {
                val analysis = inputOutputAnalyzer.analyzeCacheability(phase, mavenProject)
                val phaseNode = objectMapper.createObjectNode()
                phaseNode.put("cacheable", analysis.cacheable)
                phaseNode.put("reason", analysis.reason)
                
                if (analysis.cacheable) {
                    phaseNode.put("inputs", analysis.inputs)
                    phaseNode.put("outputs", analysis.outputs)
                }
                
                phases.put(phase, phaseNode)
                
            } catch (e: Exception) {
                // Skip phases that fail analysis
                log.debug("Skipped phase '$phase' for project ${mavenProject.artifactId}: ${e.message}")
            }
        }
        projectNode.put("phases", phases)
        
        // Basic plugin goals (skip expensive discovery for now)
        val pluginGoalsNode = objectMapper.createArrayNode()
        projectNode.put("pluginGoals", pluginGoalsNode)
        
        // Additional metadata
        projectNode.put("hasTests", File(mavenProject.basedir, "src/test/java").let { it.exists() && it.isDirectory })
        projectNode.put("hasResources", File(mavenProject.basedir, "src/main/resources").let { it.exists() && it.isDirectory })
        projectNode.put("projectName", "${mavenProject.groupId}.${mavenProject.artifactId}")
        
        // Simple test class discovery
        val testClassDiscovery = TestClassDiscovery()
        val testClasses = testClassDiscovery.discoverTestClasses(mavenProject)
        projectNode.put("testClasses", testClasses)
        
        return projectNode
    }
    
    private fun determineProjectType(packaging: String): String {
        return when (packaging.lowercase()) {
            "pom" -> "library"
            "jar", "war", "ear" -> "application" 
            "maven-plugin" -> "library"
            else -> "library"
        }
    }
    
    private fun generateNxConfigurations(
        projectAnalyses: Map<String, ObjectNode>,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>
    ): com.fasterxml.jackson.databind.node.ArrayNode {
        val createNodesResults = objectMapper.createArrayNode()
        
        for ((projectName, analysis) in projectAnalyses) {
            val mavenProject = allProjects.find { "${it.groupId}.${it.artifactId}" == projectName }
            if (mavenProject != null) {
                val nxConfig = generateNxConfigFromAnalysis(analysis, mavenProject, coordinatesToProjectName, allProjects, projectAnalyses)
                if (nxConfig != null) {
                    createNodesResults.add(nxConfig)
                }
            }
        }
        
        return createNodesResults
    }
    
    private fun generateNxConfigFromAnalysis(
        analysis: ObjectNode,
        mavenProject: MavenProject,
        coordinatesToProjectName: Map<String, String>,
        allProjects: List<MavenProject>,
        projectAnalyses: Map<String, ObjectNode>
    ): com.fasterxml.jackson.databind.node.ArrayNode {
        val projectName = analysis.get("projectName")?.asText() 
            ?: "${mavenProject.groupId}.${mavenProject.artifactId}"
        val rawRoot = analysis.get("root")?.asText() ?: ""
        val root = if (rawRoot.isEmpty()) "." else rawRoot
        
        // Create project tuple [pom.xml path, config]  
        val projectTuple = objectMapper.createArrayNode()
        val pomPath = if (root == ".") "pom.xml" else "$root/pom.xml"
        projectTuple.add(pomPath)
        
        val projectConfig = objectMapper.createObjectNode()
        val projects = objectMapper.createObjectNode()
        val project = objectMapper.createObjectNode()
        
        // Basic project info
        project.put("name", projectName)
        project.put("root", root)
        project.put("projectType", analysis.get("projectType")?.asText() ?: "library")
        project.put("sourceRoot", "$root/src/main/java")
        
        // Generate targets from phase analysis
        val targets = objectMapper.createObjectNode()
        val phasesNode = analysis.get("phases")
        
        if (phasesNode != null && phasesNode.isObject) {
            phasesNode.fields().forEach { (phase, phaseAnalysis) ->
                val target = objectMapper.createObjectNode()
                target.put("executor", "nx:run-commands")
                
                val options = objectMapper.createObjectNode()
                // Optimize install command to skip tests (already run during verify)
                val command = if (phase == "install") {
                    "mvn install -DskipTests -pl ${mavenProject.groupId}:${mavenProject.artifactId}"
                } else {
                    "mvn $phase -pl ${mavenProject.groupId}:${mavenProject.artifactId}"
                }
                options.put("command", command)
                options.put("cwd", "{workspaceRoot}")
                target.put("options", options)
                
                // Add dependency resolution
                val dependsOn = dependencyResolver.computeDependsOnForPhase(
                    phase, mavenProject, coordinatesToProjectName, allProjects, projectAnalyses
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
                    // Enable caching for specific phases that don't have side effects
                    val cacheablePhases = setOf("compile", "test-compile", "package")
                    if (phase in cacheablePhases) {
                        target.put("cache", true)
                        // Add basic inputs/outputs for caching
                        val inputs = objectMapper.createArrayNode().apply {
                            add("production")
                            add("^production") 
                        }
                        val outputs = objectMapper.createArrayNode().apply {
                            when (phase) {
                                "compile" -> {
                                    add("{projectRoot}/target/classes")
                                }
                                "test-compile" -> {
                                    add("{projectRoot}/target/test-classes")
                                }
                                "package" -> {
                                    add("{projectRoot}/target/*.jar")
                                    add("{projectRoot}/target/*.war")
                                }
                            }
                        }
                        target.put("inputs", inputs)
                        target.put("outputs", outputs)
                    } else {
                        target.put("cache", false)
                    }
                }
                
                target.put("parallelism", true)
                targets.put(phase, target)
            }
        }
        
        // Remove test-related targets if project has no tests
        val hasTests = analysis.get("hasTests")?.asBoolean() ?: false
        if (!hasTests) {
            targets.remove("test")
            targets.remove("test-compile")
        }
        
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
    }
}
