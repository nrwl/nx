package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log

/**
 * Analyzes Maven lifecycle phases and plugin goals for projects
 */
class MavenLifecycleAnalyzer(
    private val lifecycleExecutor: LifecycleExecutor,
    private val session: MavenSession,
    private val objectMapper: ObjectMapper,
    private val log: Log
) {
    
    fun extractLifecycleData(mavenProject: MavenProject): ObjectNode {
        val lifecycleNode = objectMapper.createObjectNode()
        
        try {
            // Get execution plans for all major Maven lifecycles
            val lifecyclePhases = listOf("deploy", "clean", "site")
            val allExecutionPlans = lifecyclePhases.mapNotNull { phase ->
                try {
                    lifecycleExecutor.calculateExecutionPlan(session, phase)
                } catch (e: Exception) {
                    // Could not calculate execution plan for phase
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
}