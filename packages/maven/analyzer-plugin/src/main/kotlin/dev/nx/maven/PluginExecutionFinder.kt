package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Finds plugin executions for specific Maven phases using Maven's lifecycle executor
 */
class PluginExecutionFinder(
    private val log: Log,
    private val lifecycleExecutor: LifecycleExecutor,
    private val session: MavenSession
) {
    
    // Cache for expensive calculateExecutionPlan results
    // Key: "phase:packaging:groupId" (projects with same characteristics often have same execution plans)
    private val executionPlanCache = mutableMapOf<String, List<org.apache.maven.plugin.MojoExecution>>()
    
    /**
     * Get effective plugins by accessing Maven's resolved model including inherited plugins
     */
    private fun getEffectivePlugins(project: MavenProject): List<org.apache.maven.model.Plugin> {
        try {
            log.info("Getting effective plugins for ${project.artifactId}")
            log.info("  Direct buildPlugins: ${project.buildPlugins.size}")
            log.info("  Model build plugins: ${project.model.build?.plugins?.size ?: 0}")
            
            // First try to get the project's effective model which includes inherited plugins
            val effectiveModel = project.model
            if (effectiveModel.build?.pluginManagement?.plugins != null) {
                val managedPlugins = effectiveModel.build.pluginManagement.plugins
                log.info("  Found ${managedPlugins.size} plugins in pluginManagement")
                
                // Look for japicmp in pluginManagement
                for (plugin in managedPlugins) {
                    if (plugin.artifactId.contains("japicmp")) {
                        log.warn("  Found japicmp in pluginManagement: ${plugin.groupId}:${plugin.artifactId}")
                        
                        // Check if it has executions bound to verify phase
                        for (execution in plugin.executions) {
                            log.warn("    Execution: ${execution.id} -> phase: ${execution.phase}, goals: ${execution.goals}")
                        }
                    }
                }
                
                // Combine managed plugins with direct build plugins
                val allPlugins = mutableListOf<org.apache.maven.model.Plugin>()
                allPlugins.addAll(project.buildPlugins)
                
                // Add managed plugins that have executions bound to phases
                for (managedPlugin in managedPlugins) {
                    if (managedPlugin.executions.isNotEmpty()) {
                        // Check if this plugin is already in buildPlugins
                        val existing = project.buildPlugins.find { 
                            it.artifactId == managedPlugin.artifactId && it.groupId == managedPlugin.groupId
                        }
                        if (existing == null) {
                            log.info("  Adding managed plugin with executions: ${managedPlugin.artifactId}")
                            allPlugins.add(managedPlugin)
                        }
                    }
                }
                
                log.info("  Total effective plugins: ${allPlugins.size}")
                return allPlugins
            }
            
            // Try the session projects
            val projectFromSession = session.projects.find { it.artifactId == project.artifactId }
            if (projectFromSession != null && projectFromSession != project) {
                log.info("  Using session project with ${projectFromSession.buildPlugins.size} plugins")
                return projectFromSession.buildPlugins
            }
            
        } catch (e: Exception) {
            log.warn("Failed to get effective plugins: ${e.message}")
            e.printStackTrace()
        }
        
        log.info("  Falling back to direct buildPlugins: ${project.buildPlugins.size}")
        return project.buildPlugins
    }
    
    /**
     * Finds all plugin executions that will run during the specified phase
     * Returns a list of MojoExecutions that Maven would actually execute
     */
    fun findExecutionsForPhase(phase: String, project: MavenProject): List<org.apache.maven.plugin.MojoExecution> {
        // Create cache key based on characteristics that affect execution plan
        val cacheKey = "$phase:${project.packaging}:${project.groupId}"
        
        // Check cache first
        executionPlanCache[cacheKey]?.let { cachedExecutions ->
            log.debug("Using cached execution plan for $cacheKey (${cachedExecutions.size} executions)")
            return cachedExecutions
        }
        
        val executions = mutableListOf<org.apache.maven.plugin.MojoExecution>()
        
        try {
            log.warn("*** CALCULATING EXECUTION PLAN FOR PHASE '$phase' (cache miss: $cacheKey) ***")
            log.warn("  Project: ${project.artifactId}")
            log.warn("  Session current project: ${session.currentProject?.artifactId}")
            
            // Use Maven's LifecycleExecutor to calculate what would actually run
            val originalProject = session.currentProject
            try {
                session.currentProject = project
                log.warn("  Set session current project to: ${session.currentProject?.artifactId}")
                
                val executionPlan = lifecycleExecutor.calculateExecutionPlan(session, phase)
                log.warn("  Execution plan calculated successfully!")
                log.warn("  Total executions in plan: ${executionPlan.mojoExecutions.size}")
                
                // Log all executions for debugging
                executionPlan.mojoExecutions.forEach { execution ->
                    log.warn("    Execution: ${execution.plugin.artifactId}:${execution.goal} -> phase=${execution.lifecyclePhase}")
                }
                
                // Filter to only executions that run in the requested phase
                for (execution in executionPlan.mojoExecutions) {
                    if (execution.lifecyclePhase == phase) {
                        executions.add(execution)
                        log.warn("  *** ADDED EXECUTION FOR PHASE '$phase': ${execution.plugin.artifactId}:${execution.goal} ***")
                    }
                }
                
            } finally {
                session.currentProject = originalProject
                log.warn("  Restored session current project to: ${session.currentProject?.artifactId}")
            }
            
        } catch (e: Exception) {
            log.warn("*** EXCEPTION calculating execution plan for phase '$phase': ${e.javaClass.simpleName} - ${e.message} ***")
            e.printStackTrace()
        }
        
        // If we couldn't get the execution plan, fall back to analyzing project plugins
        if (executions.isEmpty()) {
            log.warn("No executions found via calculateExecutionPlan, trying fallback analysis for phase '$phase'")
            executions.addAll(findExecutionsFromProjectPlugins(phase, project))
        }
        
        // Cache the result for future use (even if empty - that's a valid result)
        executionPlanCache[cacheKey] = executions
        log.debug("Cached execution plan for $cacheKey (${executions.size} executions)")
        
        return executions
    }
    
    /**
     * Fallback method that analyzes the project's configured plugins directly
     */
    private fun findExecutionsFromProjectPlugins(phase: String, project: MavenProject): List<org.apache.maven.plugin.MojoExecution> {
        val executions = mutableListOf<org.apache.maven.plugin.MojoExecution>()
        
        log.info("Fallback: analyzing project plugins for phase '$phase'")
        
        // Use the effective plugins method
        val effectivePlugins = getEffectivePlugins(project)
        log.info("Using ${effectivePlugins.size} effective plugins for analysis")
        
        // Log all plugins for debugging
        for (p in effectivePlugins) {
            val groupId = p.groupId ?: "org.apache.maven"
            log.info("  Plugin: $groupId:${p.artifactId}:${p.version ?: "unknown"}")
            if (p.artifactId.contains("japicmp")) {
                log.info("    *** FOUND JAPICMP PLUGIN ***")
            }
        }
        
        val allPluginsToCheck = effectivePlugins
        
        for (plugin in allPluginsToCheck) {
            log.debug("Checking plugin: ${plugin.artifactId}")
            
            for (execution in plugin.executions) {
                if (execution.phase == phase) {
                    log.warn("  Found execution '${execution.id}' bound to phase '$phase' in plugin ${plugin.artifactId}")
                    for (goal in execution.goals) {
                        try {
                            // Create a simplified MojoExecution for analysis
                            val mojoExecution = org.apache.maven.plugin.MojoExecution(
                                plugin,
                                goal,
                                execution.id
                            )
                            mojoExecution.lifecyclePhase = phase
                            executions.add(mojoExecution)
                            log.warn("    Added goal: ${plugin.artifactId}:$goal")
                        } catch (e: Exception) {
                            log.debug("    Failed to create execution for ${plugin.artifactId}:$goal: ${e.message}")
                        }
                    }
                }
            }
            
            // Check for default phase bindings
            val defaultGoals = getDefaultGoalsForPhase(plugin.artifactId, phase)
            if (defaultGoals.isNotEmpty() && plugin.executions.none { it.phase == phase }) {
                log.debug("  Plugin ${plugin.artifactId} has default goals for phase '$phase': $defaultGoals")
                for (goal in defaultGoals) {
                    try {
                        val mojoExecution = org.apache.maven.plugin.MojoExecution(
                            plugin,
                            goal,
                            "default-$goal"
                        )
                        mojoExecution.lifecyclePhase = phase
                        executions.add(mojoExecution)
                        log.debug("    Added default goal: ${plugin.artifactId}:$goal")
                    } catch (e: Exception) {
                        log.debug("    Failed to create default execution for ${plugin.artifactId}:$goal: ${e.message}")
                    }
                }
            }
        }
        
        log.debug("Fallback analysis found ${executions.size} executions for phase '$phase'")
        return executions
    }
    
    /**
     * Returns the default goals that a plugin executes during a specific phase
     * Based on standard Maven plugin lifecycle bindings
     */
    private fun getDefaultGoalsForPhase(artifactId: String, phase: String): List<String> {
        return when (artifactId to phase) {
            "maven-compiler-plugin" to "compile" -> listOf("compile")
            "maven-compiler-plugin" to "test-compile" -> listOf("testCompile")
            "maven-surefire-plugin" to "test" -> listOf("test")
            "maven-failsafe-plugin" to "integration-test" -> listOf("integration-test")
            "maven-failsafe-plugin" to "verify" -> listOf("verify")
            "maven-jar-plugin" to "package" -> listOf("jar")
            "maven-war-plugin" to "package" -> listOf("war")
            "maven-ear-plugin" to "package" -> listOf("ear")
            "maven-resources-plugin" to "process-resources" -> listOf("resources")
            "maven-resources-plugin" to "process-test-resources" -> listOf("testResources")
            "maven-install-plugin" to "install" -> listOf("install")
            "maven-deploy-plugin" to "deploy" -> listOf("deploy")
            "maven-clean-plugin" to "clean" -> listOf("clean")
            "japicmp-maven-plugin" to "verify" -> listOf("cmp")
            else -> emptyList()
        }
    }
}