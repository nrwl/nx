package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Investigates what plugins are already loaded/available in the Maven session
 */
class MavenSessionInvestigator(
    private val log: Log,
    private val session: MavenSession
) {
    
    fun investigateLoadedPlugins(project: MavenProject): Map<String, Any> {
        val investigation = mutableMapOf<String, Any>()
        
        try {
            // Check what's already available in the session
            log.info("=== Maven Session Investigation ===")
            
            // 1. Check project plugin artifacts
            val pluginArtifacts = project.pluginArtifacts
            investigation["project.pluginArtifacts.count"] = pluginArtifacts?.size ?: 0
            
            if (pluginArtifacts != null && pluginArtifacts.isNotEmpty()) {
                log.info("Found ${pluginArtifacts.size} plugin artifacts:")
                pluginArtifacts.take(5).forEach { artifact ->
                    log.info("  - ${artifact.groupId}:${artifact.artifactId}:${artifact.version}")
                }
            }
            
            // 2. Check project execution context  
            investigation["project.executionRoot"] = project.isExecutionRoot
            
            // 3. Check session projects
            investigation["session.projects.count"] = session.projects?.size ?: 0
            
            // 4. Check if there's a plugin manager in the session
            val pluginManager = session.container?.lookup("org.apache.maven.plugin.MavenPluginManager")
            investigation["session.pluginManager.available"] = pluginManager != null
            
            // 5. Check project plugin artifacts map
            val pluginArtifactMap = project.pluginArtifactMap
            investigation["project.pluginArtifactMap.count"] = pluginArtifactMap?.size ?: 0
            
            if (pluginArtifactMap != null && pluginArtifactMap.isNotEmpty()) {
                log.info("Plugin artifact map entries:")
                pluginArtifactMap.entries.take(5).forEach { (key, value) ->
                    log.info("  - $key -> ${value.groupId}:${value.artifactId}:${value.version}")
                }
            }
            
            // 6. Check project execution project - might have plugin info
            val executionProject = project.executionProject
            investigation["project.executionProject.available"] = executionProject != null
            
            // 7. Check build plugins from the model vs runtime  
            val buildPlugins = project.buildPlugins
            investigation["project.buildPlugins.count"] = buildPlugins?.size ?: 0
            
            if (buildPlugins != null && buildPlugins.isNotEmpty()) {
                log.info("Build plugins from model:")
                buildPlugins.forEach { plugin ->
                    log.info("  - ${plugin.groupId ?: "org.apache.maven.plugins"}:${plugin.artifactId}")
                    log.info("    Version: ${plugin.version ?: "not specified"}")
                    log.info("    Executions: ${plugin.executions?.size ?: 0}")
                }
            }
            
            // 8. Check if any plugins are in "resolved" state
            try {
                val container = session.container
                val pluginManagerType = Class.forName("org.apache.maven.plugin.internal.DefaultMavenPluginManager")
                val pluginManagerInstance = container?.lookup(pluginManagerType)
                investigation["internal.pluginManager.available"] = pluginManagerInstance != null
                
                if (pluginManagerInstance != null) {
                    log.info("Found internal plugin manager: ${pluginManagerInstance.javaClass.name}")
                    
                    // Try to access plugin container/cache via reflection if available
                    try {
                        val pluginCacheField = pluginManagerType.getDeclaredField("pluginCache")
                        pluginCacheField.isAccessible = true
                        val pluginCache = pluginCacheField.get(pluginManagerInstance)
                        investigation["internal.pluginCache.available"] = pluginCache != null
                        log.info("Plugin cache available: ${pluginCache != null}")
                    } catch (e: Exception) {
                        log.info("Could not access plugin cache: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                investigation["internal.pluginManager.error"] = e.message ?: "unknown"
            }
            
        } catch (e: Exception) {
            investigation["investigation.error"] = e.message ?: "unknown"
            log.error("Maven session investigation failed", e)
        }
        
        return investigation
    }
}