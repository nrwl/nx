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
            val goalsSet = LinkedHashSet<GoalInfo>() // Use LinkedHashSet to maintain order and eliminate duplicates
            
            // Discover all phases and bound goals
            val discoveredPhases = discoverPhases(mavenProject)
            val boundGoals = discoverBoundGoals(mavenProject)
            goalsSet.addAll(boundGoals)
            
            // Discover all plugins and their goals
            val (pluginsArray, pluginGoals) = discoverPluginData(mavenProject, goalsSet)
            goalsSet.addAll(pluginGoals)
            
            // Add phases to JSON
            val phasesArray = objectMapper.createArrayNode()
            discoveredPhases.forEach { phase -> phasesArray.add(phase) }
            lifecycleNode.put("phases", phasesArray)
            
            // Add goals to JSON
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
            
            // Add common Maven phases based on packaging
            val commonPhases = getCommonPhases(mavenProject.packaging)
            lifecycleNode.put("commonPhases", commonPhases)
            
        } catch (e: Exception) {
            log.error("Failed to extract lifecycle data for project: ${mavenProject.artifactId}", e)
            throw e
        }
        
        return lifecycleNode
    }
    
    /**
     * Discovers all plugin data including configured executions and available goals
     */
    private fun discoverPluginData(mavenProject: MavenProject, goalsSet: MutableSet<GoalInfo>): Pair<com.fasterxml.jackson.databind.node.ArrayNode, Set<GoalInfo>> {
        val pluginsArray = objectMapper.createArrayNode()
        val pluginGoals = mutableSetOf<GoalInfo>()
        
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
                        pluginGoals.add(GoalInfo(
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
            discoverAllPluginGoals(plugin, mavenProject, pluginGoals)
        }
        
        return pluginsArray to pluginGoals
    }
    
    /**
     * Gets common Maven phases based on packaging type
     */
    private fun getCommonPhases(packaging: String): com.fasterxml.jackson.databind.node.ArrayNode {
        val commonPhases = objectMapper.createArrayNode()
        
        // Clean is available for all project types
        commonPhases.add("clean")
        
        when (packaging.lowercase()) {
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
                commonPhases.add("verify")
                commonPhases.add("install")
                commonPhases.add("deploy")
            }
        }
        
        return commonPhases
    }
    
    /**
     * Discovers all lifecycle phases for a project
     */
    private fun discoverPhases(mavenProject: MavenProject): Set<String> {
        val uniquePhases = mutableSetOf<String>()
        
        // First, ensure essential phases are always included
        val essentialPhases = listOf("verify", "integration-test", "pre-integration-test", "post-integration-test")
        uniquePhases.addAll(essentialPhases)
        
        // Get execution plans for all major Maven lifecycles
        val lifecyclePhases = listOf("deploy", "clean", "site", "validate", "compile", "test", "package", "verify", "install")
        val allExecutionPlans = lifecyclePhases.map { phase ->
            lifecycleExecutor.calculateExecutionPlan(session, phase)
        }
        
        // Extract phases from execution plans
        for (executionPlan in allExecutionPlans) {
            for (execution in executionPlan.mojoExecutions) {
                execution.lifecyclePhase?.let { phase ->
                    uniquePhases.add(phase)
                }
            }
        }
        
        return uniquePhases
    }
    
    /**
     * Discovers bound goals from Maven execution plans
     */
    private fun discoverBoundGoals(mavenProject: MavenProject): Set<GoalInfo> {
        val goalsSet = mutableSetOf<GoalInfo>()
        
        // Get execution plans for all major Maven lifecycles
        val lifecyclePhases = listOf("deploy", "clean", "site", "validate", "compile", "test", "package", "verify", "install")
        val allExecutionPlans = lifecyclePhases.map { phase ->
            lifecycleExecutor.calculateExecutionPlan(session, phase)
        }
        
        // Extract goals from execution plans
        for (executionPlan in allExecutionPlans) {
            for (execution in executionPlan.mojoExecutions) {
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
        
        return goalsSet
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
                phase = mojo.phase ?: "unbound", // Mark as unbound if not bound to phase
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