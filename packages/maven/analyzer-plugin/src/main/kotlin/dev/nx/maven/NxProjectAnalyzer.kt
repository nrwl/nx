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
        try {
            val pathResolver = PathResolver(workspaceRoot, project.basedir.absolutePath, session)
            val mavenCommand = pathResolver.getMavenCommand()
            
            // Calculate relative path from workspace root
            val workspaceRootPath = Paths.get(workspaceRoot)
            val projectPath = project.basedir.toPath()
            val root = workspaceRootPath.relativize(projectPath).toString().replace('\\', '/')
            val projectName = "${project.groupId}.${project.artifactId}"
            val projectType = determineProjectType(project.packaging)
            
            // Create Nx project configuration
            val nxProject = objectMapper.createObjectNode()
            nxProject.put("name", projectName)
            nxProject.put("root", root)
            nxProject.put("projectType", projectType)
            nxProject.put("sourceRoot", "${root}/src/main/java")
            
            // Analyze phases and generate targets
            val targets = objectMapper.createObjectNode()
            val mavenPhaseTargets = mutableListOf<String>()
            
            // Extract lifecycle data for phase and goal discovery
            val lifecycleData = sharedLifecycleAnalyzer.extractLifecycleData(project)
            
            // Extract discovered phases from lifecycle analysis
            val discoveredPhases = mutableSetOf<String>()
            lifecycleData.get("phases")?.forEach { phaseNode ->
                discoveredPhases.add(phaseNode.asText())
            }
            lifecycleData.get("commonPhases")?.forEach { phaseNode ->
                discoveredPhases.add(phaseNode.asText())
            }
            
            // Extract discovered plugin goals
            val discoveredGoals = extractPluginGoals(lifecycleData)
            
            // If no phases discovered, fall back to essential phases
            val phasesToAnalyze = if (discoveredPhases.isNotEmpty()) {
                discoveredPhases.toList()
            } else {
                listOf("validate", "compile", "test-compile", "test", "package", "clean")
            }
            
            log.info("Analyzing ${phasesToAnalyze.size} phases for ${project.artifactId}: ${phasesToAnalyze.joinToString(", ")}")
            
            // Generate targets from phase analysis
            phasesToAnalyze.forEach { phase ->
                try {
                    val analysis = sharedInputOutputAnalyzer.analyzeCacheability(phase, project)
                    log.warn("Phase '$phase' analysis result: cacheable=${analysis.cacheable}, reason='${analysis.reason}'")
                    
                    val target = objectMapper.createObjectNode()
                    target.put("executor", "nx:run-commands")
                    
                    val options = objectMapper.createObjectNode()
                    options.put("command", "$mavenCommand $phase -pl ${project.groupId}:${project.artifactId}")
                    options.put("cwd", "{workspaceRoot}")
                    target.put("options", options)
                    
                    // Copy caching info from analysis
                    if (analysis.cacheable) {
                        target.put("cache", true)
                        target.put("inputs", analysis.inputs)
                        target.put("outputs", analysis.outputs)
                    } else {
                        target.put("cache", false)
                    }
                    
                    target.put("parallelism", true)
                    targets.put(phase, target)
                    mavenPhaseTargets.add(phase)
                    
                } catch (e: Exception) {
                    log.debug("Failed to analyze phase '$phase' for project ${project.artifactId}: ${e.message}")
                }
            }
            
            // Generate targets from discovered plugin goals
            val targetGroups = objectMapper.createObjectNode()
            
            if (discoveredGoals.isNotEmpty()) {
                val goalsByPlugin = mutableMapOf<String, MutableList<String>>()
                
                discoveredGoals.forEach { pluginGoal ->
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
            val hasTests = File(project.basedir, "src/test/java").let { it.exists() && it.isDirectory }
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
            
            log.info("Analyzed project: ${project.artifactId} at $root")
            
            return root to nxProject
            
        } catch (e: Exception) {
            log.error("Failed to analyze project ${project.artifactId}: ${e.message}", e)
            return null
        }
    }
    
    private fun extractPluginGoals(lifecycleData: com.fasterxml.jackson.databind.JsonNode): Set<String> {
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
        return discoveredGoals
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