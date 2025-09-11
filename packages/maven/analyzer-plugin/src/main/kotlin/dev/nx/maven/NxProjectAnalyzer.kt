package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.project.MavenProject
import java.io.File
import java.nio.file.Paths

/**
 * Analyzer for a single Maven project structure to generate JSON for Nx integration
 * This is a simplified, per-project analyzer that doesn't require cross-project coordination
 */
class NxProjectAnalyzer(
    private val session: MavenSession,
    private val project: MavenProject,
    private val pluginManager: org.apache.maven.plugin.MavenPluginManager,
    private val lifecycleExecutor: LifecycleExecutor,
    private val workspaceRoot: String,
    private val log: org.apache.maven.plugin.logging.Log,
    private val sharedInputOutputAnalyzer: MavenInputOutputAnalyzer,
    private val sharedLifecycleAnalyzer: MavenLifecycleAnalyzer,
    private val sharedTestClassDiscovery: TestClassDiscovery
) {
    private val objectMapper = ObjectMapper()

    
    /**
     * Analyzes the project and returns Nx project config
     */
    fun analyze(): Pair<String, com.fasterxml.jackson.databind.node.ObjectNode>? {
        val projectAnalysis = analyzeSingleProject(project)
        return generateNxProjectConfigFromAnalysis(projectAnalysis)
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
        
        // Add discovered plugin goals to the project node
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
    
    /**
     * Generate complete Nx project configuration with targets from project analysis data
     */
    private fun generateNxProjectConfigFromAnalysis(projectNode: com.fasterxml.jackson.databind.node.ObjectNode): Pair<String, com.fasterxml.jackson.databind.node.ObjectNode>? {
        try {
            val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath, session)
            val mavenCommand = pathResolver.getMavenCommand()
            val root = projectNode.get("root")?.asText() ?: return null
            val projectName = "${project.groupId}.${project.artifactId}"
            
            // Create Nx project configuration
            val nxProject = objectMapper.createObjectNode()
            nxProject.put("name", projectName)
            nxProject.put("root", root)
            nxProject.put("projectType", projectNode.get("projectType")?.asText() ?: "library")
            nxProject.put("sourceRoot", "${root}/src/main/java")
            
            // Generate targets from phase analysis
            val targets = objectMapper.createObjectNode()
            val phasesNode = projectNode.get("phases")
            val mavenPhaseTargets = mutableListOf<String>()
            
            if (phasesNode != null && phasesNode.isObject) {
                phasesNode.fields().forEach { (phase, phaseAnalysis) ->
                    val target = objectMapper.createObjectNode()
                    target.put("executor", "nx:run-commands")
                    
                    val options = objectMapper.createObjectNode()
                    options.put("command", "$mavenCommand $phase -pl ${project.groupId}:${project.artifactId}")
                    options.put("cwd", "{workspaceRoot}")
                    target.put("options", options)
                    
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
                    mavenPhaseTargets.add(phase)
                }
            }
            
            // Generate targets from discovered plugin goals
            val pluginGoalsNode = projectNode.get("pluginGoals")
            val targetGroups = objectMapper.createObjectNode()
            
            if (pluginGoalsNode != null && pluginGoalsNode.isArray) {
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
                
                goalsByPlugin.forEach { (cleanPluginName, pluginGoals) ->
                    val pluginTargetGroup = objectMapper.createArrayNode()
                    
                    pluginGoals.forEach { pluginGoal ->
                        val parts = pluginGoal.split(":")
                        val originalPluginName = parts[0]
                        val goalName = parts[1]
                        
                        val target = objectMapper.createObjectNode()
                        target.put("executor", "nx:run-commands")
                        
                        val options = objectMapper.createObjectNode()
                        options.put("command", "$mavenCommand $cleanPluginName:$goalName -pl ${project.groupId}:${project.artifactId}")
                        options.put("cwd", "{workspaceRoot}")
                        target.put("options", options)
                        
                        target.put("cache", false)
                        target.put("parallelism", false)
                        
                        val targetName = "$cleanPluginName:$goalName"
                        targets.put(targetName, target)
                        pluginTargetGroup.add(targetName)
                    }
                    
                    targetGroups.put(cleanPluginName, pluginTargetGroup)
                }
            }
            
            // Remove test-related targets if project has no tests
            val hasTests = projectNode.get("hasTests")?.asBoolean() ?: false
            if (!hasTests) {
                targets.remove("test")
                targets.remove("test-compile")
            }
            
            // Add clean target (always uncached)
            val cleanTarget = objectMapper.createObjectNode()
            cleanTarget.put("executor", "nx:run-commands")
            val cleanOptions = objectMapper.createObjectNode()
            cleanOptions.put("command", "$mavenCommand clean -pl ${project.groupId}:${project.artifactId}")
            cleanOptions.put("cwd", "{workspaceRoot}")
            cleanTarget.put("options", cleanOptions)
            cleanTarget.put("cache", false)
            cleanTarget.put("parallelism", true)
            targets.put("clean", cleanTarget)
            mavenPhaseTargets.add("clean")
            
            nxProject.put("targets", targets)
            
            // Add Maven phases to target groups
            if (mavenPhaseTargets.isNotEmpty()) {
                val mavenPhasesGroup = objectMapper.createArrayNode()
                mavenPhaseTargets.forEach { phase -> mavenPhasesGroup.add(phase) }
                targetGroups.put("maven-phases", mavenPhasesGroup)
            }
            
            // Project metadata including target groups
            val projectMetadata = objectMapper.createObjectNode()
            projectMetadata.put("targetGroups", targetGroups)
            nxProject.put("metadata", projectMetadata)
            
            // Tags
            val tags = objectMapper.createArrayNode()
            tags.add("maven:${project.groupId}")
            tags.add("maven:${project.packaging}")
            nxProject.put("tags", tags)
            
            return root to nxProject
            
        } catch (e: Exception) {
            log.error("Failed to generate Nx config for project ${project.artifactId}: ${e.message}", e)
            return null
        }
    }
    
    /**
     * Clean plugin name for better target naming
     */
    private fun cleanPluginName(pluginName: String): String {
        return pluginName
            .replace("org.apache.maven.plugins.", "")
            .replace("maven-", "")
            .replace("-plugin", "")
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