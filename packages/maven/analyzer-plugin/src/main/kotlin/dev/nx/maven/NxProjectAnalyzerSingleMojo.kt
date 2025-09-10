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
 * Maven plugin to analyze a single project structure and generate JSON for Nx integration
 * This is a simplified, per-project analyzer that doesn't require cross-project coordination
 */
@Mojo(
    name = "analyze-project",
    aggregator = false,
    requiresDependencyResolution = ResolutionScope.NONE
)
class NxProjectAnalyzerSingleMojo : AbstractMojo() {

    @Parameter(defaultValue = "\${session}", readonly = true, required = true)
    private lateinit var session: MavenSession

    @Parameter(defaultValue = "\${project}", readonly = true, required = true)
    private lateinit var project: MavenProject

    @Component
    private lateinit var pluginManager: org.apache.maven.plugin.MavenPluginManager

    @Component
    private lateinit var lifecycleExecutor: LifecycleExecutor

    @Parameter(property = "nx.outputFile")
    private var outputFile: String? = null

    @Parameter(property = "nx.workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
    private lateinit var workspaceRoot: String

    private val objectMapper = ObjectMapper()
    
    // Shared component instances for optimization
    private var sharedInputOutputAnalyzer: MavenInputOutputAnalyzer? = null
    private var sharedLifecycleAnalyzer: MavenLifecycleAnalyzer? = null
    private var sharedTestClassDiscovery: TestClassDiscovery? = null
    
    // Setters for orchestrated execution
    fun setProject(project: MavenProject) {
        this.project = project
    }
    
    fun setSession(session: MavenSession) {
        this.session = session
    }
    
    fun setPluginManager(pluginManager: org.apache.maven.plugin.MavenPluginManager) {
        this.pluginManager = pluginManager
    }
    
    fun setLifecycleExecutor(lifecycleExecutor: LifecycleExecutor) {
        this.lifecycleExecutor = lifecycleExecutor
    }
    
    fun setWorkspaceRoot(workspaceRoot: String) {
        this.workspaceRoot = workspaceRoot
    }
    
    // Setters for shared component instances (optimization)
    fun setSharedInputOutputAnalyzer(analyzer: MavenInputOutputAnalyzer) {
        this.sharedInputOutputAnalyzer = analyzer
    }
    
    fun setSharedLifecycleAnalyzer(analyzer: MavenLifecycleAnalyzer) {
        this.sharedLifecycleAnalyzer = analyzer
    }
    
    fun setSharedTestClassDiscovery(discovery: TestClassDiscovery) {
        this.sharedTestClassDiscovery = discovery
    }

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing single Maven project '${project.artifactId}' for Nx integration...")
        
        try {
            val projectAnalysis = analyzeSingleProject(project)
            
            // Determine output file - if not specified, use project-specific name
            val outputPath = if (outputFile != null) {
                if (outputFile!!.startsWith("/")) {
                    File(outputFile!!)
                } else {
                    File(workspaceRoot, outputFile!!)
                }
            } else {
                // Default: write to project's target directory
                File(project.build.directory, "nx-project-analysis.json")
            }
            
            // Ensure parent directory exists
            outputPath.parentFile?.mkdirs()
            
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, projectAnalysis)
            
            log.info("Generated single project analysis: ${outputPath.absolutePath}")
            
        } catch (e: IOException) {
            throw MojoExecutionException("Failed to generate single project analysis", e)
        }
    }
    
    /**
     * Analyzes the project and returns the result in memory (optimization for in-memory analysis)
     */
    fun analyzeProjectInMemory(): com.fasterxml.jackson.databind.node.ObjectNode {
        return analyzeSingleProject(project)
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
        
        // Use shared components if available, otherwise create new ones (backward compatibility)
        val inputOutputAnalyzer = sharedInputOutputAnalyzer ?: MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, session, pluginManager, lifecycleExecutor
        )
        
        // Dynamically discover available phases using Maven's lifecycle APIs
        val phases = objectMapper.createObjectNode()
        val lifecycleAnalyzer = sharedLifecycleAnalyzer ?: MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log, pluginManager)
        val lifecycleData = lifecycleAnalyzer.extractLifecycleData(mavenProject)
        
        // Extract discovered phases from lifecycle analysis
        val discoveredPhases = mutableSetOf<String>()
        lifecycleData.get("phases")?.forEach { phaseNode ->
            discoveredPhases.add(phaseNode.asText())
        }
        lifecycleData.get("commonPhases")?.forEach { phaseNode ->
            discoveredPhases.add(phaseNode.asText())
        }
        
        // Extract discovered plugin goals (including unbound and development goals)
        val discoveredGoals = mutableSetOf<String>()
        lifecycleData.get("goals")?.forEach { goalNode ->
            val goalData = goalNode as com.fasterxml.jackson.databind.node.ObjectNode
            val plugin = goalData.get("plugin")?.asText()
            val goal = goalData.get("goal")?.asText()
            val phase = goalData.get("phase")?.asText()
            val classification = goalData.get("classification")?.asText()
            
            if (plugin != null && goal != null) {
                val shouldInclude = when {
                    // Always include truly unbound goals
                    phase == "unbound" -> true
                    
                    // Include development goals based on Maven API characteristics
                    isDevelopmentGoal(goalData) -> true
                    
                    else -> false
                }
                
                if (shouldInclude) {
                    discoveredGoals.add("$plugin:$goal")
                    log.info("Discovered ${classification ?: "unbound"} plugin goal: $plugin:$goal")
                }
            }
        }
        
        // If no phases discovered, fall back to essential phases
        val phasesToAnalyze = if (discoveredPhases.isNotEmpty()) {
            discoveredPhases.toList()
        } else {
            listOf("validate", "compile", "test-compile", "test", "package", "clean")
        }
        
        log.info("Analyzing ${phasesToAnalyze.size} phases for ${mavenProject.artifactId}: ${phasesToAnalyze.joinToString(", ")}")
        
        phasesToAnalyze.forEach { phase ->
            try {
                val analysis = inputOutputAnalyzer.analyzeCacheability(phase, mavenProject)
                log.warn("Phase '$phase' analysis result: cacheable=${analysis.cacheable}, reason='${analysis.reason}'")
                val phaseNode = objectMapper.createObjectNode()
                phaseNode.put("cacheable", analysis.cacheable)
                phaseNode.put("reason", analysis.reason)
                
                if (analysis.cacheable) {
                    phaseNode.put("inputs", analysis.inputs)
                    phaseNode.put("outputs", analysis.outputs)
                } else {
                    // For non-cacheable phases, still include them as targets but mark as non-cacheable
                    log.debug("Phase '$phase' is not cacheable: ${analysis.reason}")
                }
                
                // Always include the phase, regardless of cacheability
                phases.put(phase, phaseNode)
                
            } catch (e: Exception) {
                log.debug("Failed to analyze phase '$phase' for project ${mavenProject.artifactId}: ${e.message}")
            }
        }
        projectNode.put("phases", phases)
        
        // Add discovered plugin goals to the project node for use by NxWorkspaceGraphMojo
        val pluginGoalsNode = objectMapper.createArrayNode()
        discoveredGoals.forEach { pluginGoal ->
            pluginGoalsNode.add(pluginGoal)
        }
        projectNode.put("pluginGoals", pluginGoalsNode)
        
        // Additional metadata
        projectNode.put("hasTests", File(mavenProject.basedir, "src/test/java").let { it.exists() && it.isDirectory })
        projectNode.put("hasResources", File(mavenProject.basedir, "src/main/resources").let { it.exists() && it.isDirectory })
        projectNode.put("projectName", "${mavenProject.groupId}.${mavenProject.artifactId}")
        
        // Discover test classes for atomization using simple string matching
        val testClassDiscovery = sharedTestClassDiscovery ?: TestClassDiscovery()
        val testClasses = testClassDiscovery.discoverTestClasses(mavenProject)
        projectNode.put("testClasses", testClasses)
        
        log.info("Analyzed single project: ${mavenProject.artifactId} at $relativePath")
        
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
    
    /**
     * Determines if a goal is useful for development using Maven API characteristics
     */
    private fun isDevelopmentGoal(goalData: com.fasterxml.jackson.databind.node.ObjectNode): Boolean {
        val goal = goalData.get("goal")?.asText() ?: return false
        val phase = goalData.get("phase")?.asText() ?: return false
        val isAggregator = goalData.get("isAggregator")?.asBoolean() ?: false
        val isThreadSafe = goalData.get("isThreadSafe")?.asBoolean() ?: true
        val requiresDependencyResolution = goalData.get("requiresDependencyResolution")?.asText()
        
        // Development goals often have these characteristics:
        return when {
            // Goals commonly named for development tasks
            goal.contains("run", ignoreCase = true) -> true
            goal.contains("start", ignoreCase = true) -> true
            goal.contains("stop", ignoreCase = true) -> true
            goal.contains("dev", ignoreCase = true) -> true
            goal.contains("exec", ignoreCase = true) -> true
            goal.contains("serve", ignoreCase = true) -> true
            
            // Goals that require test compile or runtime classpath (dev tools)
            requiresDependencyResolution in listOf("test", "runtime", "compile_plus_runtime") -> {
                // Additional filtering for development-like phases
                phase in listOf("validate", "process-classes", "process-test-classes") || 
                goal.endsWith("run") || goal.endsWith("exec")
            }
            
            // Non-thread-safe goals often indicate interactive/development use
            !isThreadSafe && phase == "validate" -> true
            
            else -> false
        }
    }
}