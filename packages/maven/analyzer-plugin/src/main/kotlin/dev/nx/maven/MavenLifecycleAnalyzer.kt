package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor

/**
 * Analyzes Maven lifecycle phases and plugin goals for projects
 */
class MavenLifecycleAnalyzer(
    private val lifecycleExecutor: LifecycleExecutor,
    private val session: MavenSession,
    private val objectMapper: ObjectMapper,
    private val log: Log,
    private val pluginManager: MavenPluginManager
) {
    
    // Cache for plugin descriptors to avoid redundant loading
    private val pluginDescriptorCache = mutableMapOf<String, PluginDescriptor>()
    
    fun extractLifecycleData(mavenProject: MavenProject): ObjectNode {
        val lifecycleNode = objectMapper.createObjectNode()
        
        try {
            // Get execution plans for all major Maven lifecycles including default lifecycle
            val lifecyclePhases = listOf("deploy", "clean", "site", "validate", "compile", "test", "package", "verify", "install")
            val allExecutionPlans = lifecyclePhases.map { phase ->
                lifecycleExecutor.calculateExecutionPlan(session, phase)
            }
            
            // Extract phases from all lifecycles
            val phasesArray = objectMapper.createArrayNode()
            val goalsSet = LinkedHashSet<GoalInfo>() // Use LinkedHashSet to maintain order and eliminate duplicates
            val uniquePhases = mutableSetOf<String>()
            
            for (executionPlan in allExecutionPlans) {
                for (execution in executionPlan.mojoExecutions) {
                    execution.lifecyclePhase?.let { phase ->
                        if (!uniquePhases.contains(phase)) {
                            uniquePhases.add(phase)
                            phasesArray.add(phase)
                        }
                    }
                    // Add discovered goals with classification
                    goalsSet.add(GoalInfo(
                        groupId = execution.plugin.groupId,
                        artifactId = execution.plugin.artifactId,
                        goal = execution.goal,
                        phase = execution.lifecyclePhase ?: "unbound",
                        classification = "bound"
                    ))
                    log.info("Discovered bound goal: ${execution.plugin.groupId}:${execution.plugin.artifactId}:${execution.goal} in phase: ${execution.lifecyclePhase}")
                }
            }
            lifecycleNode.put("phases", phasesArray)
            
            // Extract plugin goals and their configurations - discover ALL plugins comprehensively
            val pluginsArray = objectMapper.createArrayNode()
            
            // Collect ALL plugins from multiple sources
            val allPlugins = mutableSetOf<org.apache.maven.model.Plugin>()
            
            // Add build plugins
            mavenProject.build?.plugins?.let { allPlugins.addAll(it) }
            
            // Add plugins from pluginManagement (these define available plugins)
            mavenProject.build?.pluginManagement?.plugins?.let { allPlugins.addAll(it) }
            
            // Add inherited plugins from parent projects
            var currentProject: MavenProject? = mavenProject
            while (currentProject?.parent != null) {
                currentProject = currentProject.parent
                currentProject.build?.plugins?.let { allPlugins.addAll(it) }
                currentProject.build?.pluginManagement?.plugins?.let { allPlugins.addAll(it) }
            }
            
            log.info("Discovered ${allPlugins.size} total plugins from all sources")
            
            for (plugin in allPlugins) {
                val pluginNode = objectMapper.createObjectNode()
                pluginNode.put("groupId", plugin.groupId)
                pluginNode.put("artifactId", plugin.artifactId)
                pluginNode.put("version", plugin.version)
                
                // Process configured executions first
                val executionsArray = objectMapper.createArrayNode()
                plugin.executions?.let { executions ->
                    for (execution in executions) {
                        val executionNode = objectMapper.createObjectNode()
                        executionNode.put("id", execution.id)
                        executionNode.put("phase", execution.phase)
                        
                        val goalsList = objectMapper.createArrayNode()
                        for (goal in execution.goals) {
                            goalsList.add(goal)
                            // Add configured goals to set
                            goalsSet.add(GoalInfo(
                                groupId = plugin.groupId,
                                artifactId = plugin.artifactId,
                                goal = goal,
                                phase = execution.phase ?: "unbound",
                                classification = "configured",
                                executionId = execution.id
                            ))
                        }
                        executionNode.put("goals", goalsList)
                        executionsArray.add(executionNode)
                    }
                }
                pluginNode.put("executions", executionsArray)
                pluginsArray.add(pluginNode)
                
                // Now discover ALL available goals from this plugin
                discoverAllPluginGoals(plugin, mavenProject, goalsSet)
            }
            
            // Convert goals set to JSON array
            val goalsArray = objectMapper.createArrayNode()
            for (goalInfo in goalsSet) {
                val goalNode = objectMapper.createObjectNode()
                goalNode.put("groupId", goalInfo.groupId)
                goalNode.put("plugin", goalInfo.artifactId)
                goalNode.put("goal", goalInfo.goal)
                goalNode.put("phase", goalInfo.phase)
                goalNode.put("classification", goalInfo.classification)
                goalInfo.executionId?.let { goalNode.put("executionId", it) }
                goalNode.put("isAggregator", goalInfo.isAggregator)
                goalNode.put("isThreadSafe", goalInfo.isThreadSafe)
                goalInfo.requiresDependencyResolution?.let { goalNode.put("requiresDependencyResolution", it) }
                goalsArray.add(goalNode)
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
            log.error("Failed to extract lifecycle data for project: ${mavenProject.artifactId}", e)
            throw e
        }
        
        return lifecycleNode
    }
    
    /**
     * Discovers ALL plugin goals with comprehensive metadata using Maven Plugin Manager API
     */
    private fun discoverAllPluginGoals(plugin: org.apache.maven.model.Plugin, mavenProject: MavenProject, goalsSet: MutableSet<GoalInfo>) {
        // Load plugin descriptor using Maven's plugin manager - no graceful fallbacks
        val pluginDescriptor = loadPluginDescriptor(plugin, mavenProject)
        
        // Get all mojos (goals) from the plugin
        val mojos = pluginDescriptor.mojos
        for (mojo in mojos) {
            // Create comprehensive goal info with all metadata
            val goalInfo = GoalInfo(
                groupId = plugin.groupId,
                artifactId = plugin.artifactId,
                goal = mojo.goal,
                phase = mojo.phase ?: "available", // Mark as available if not bound to phase
                classification = if (mojo.phase != null) "available-bound" else "available",
                isAggregator = mojo.isAggregator,
                isThreadSafe = mojo.isThreadSafe,
                requiresDependencyResolution = mojo.dependencyResolutionRequired
            )
            goalsSet.add(goalInfo)
            log.info("Discovered ${goalInfo.classification} goal: ${goalInfo.groupId}:${goalInfo.artifactId}:${goalInfo.goal} (aggregator=${goalInfo.isAggregator}, threadSafe=${goalInfo.isThreadSafe})")
        }
    }
    
    /**
     * Loads a plugin descriptor using Maven's plugin manager with caching - fails fast on errors
     */
    private fun loadPluginDescriptor(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor {
        val pluginKey = "${plugin.groupId}:${plugin.artifactId}:${plugin.version}"
        
        return pluginDescriptorCache.getOrPut(pluginKey) {
            // Use Maven's plugin manager to load the plugin descriptor - let exceptions propagate
            log.debug("Loading plugin descriptor for $pluginKey")
            pluginManager.getPluginDescriptor(plugin, project.remotePluginRepositories, session.repositorySession)
        }
    }
    
}

/**
 * Data class representing a Maven goal with classification information
 */
data class GoalInfo(
    val groupId: String,
    val artifactId: String,
    val goal: String,
    val phase: String,
    val classification: String, // bound, configured, available, aggregator
    val executionId: String? = null,
    val isAggregator: Boolean = false,
    val isThreadSafe: Boolean = true,
    val requiresDependencyResolution: String? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is GoalInfo) return false
        return groupId == other.groupId && artifactId == other.artifactId && goal == other.goal
    }
    
    override fun hashCode(): Int {
        return "$groupId:$artifactId:$goal".hashCode()
    }
}