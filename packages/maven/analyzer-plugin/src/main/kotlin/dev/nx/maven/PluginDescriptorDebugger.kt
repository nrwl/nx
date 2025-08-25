package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Debug helper to understand plugin descriptor loading failures
 */
class PluginDescriptorDebugger(
    private val log: Log,
    private val session: MavenSession,
    private val pluginManager: MavenPluginManager
) {
    
    fun debugPluginDescriptorLoading(project: MavenProject): Map<String, Any> {
        val debug = mutableMapOf<String, Any>()
        
        try {
            // Check session availability
            debug["session.available"] = session != null
            debug["session.repositorySession.available"] = session.repositorySession != null
            debug["session.container.available"] = session.container != null
            
            // Check plugin manager availability
            debug["pluginManager.available"] = pluginManager != null
            debug["pluginManager.class"] = pluginManager.javaClass.name
            
            // Check project plugin repositories
            debug["project.remotePluginRepositories.count"] = project.remotePluginRepositories?.size ?: 0
            debug["project.remotePluginRepositories.available"] = project.remotePluginRepositories != null
            
            // Try to load maven-compiler-plugin specifically
            val compilerPlugin = org.apache.maven.model.Plugin()
            compilerPlugin.groupId = "org.apache.maven.plugins"
            compilerPlugin.artifactId = "maven-compiler-plugin"
            compilerPlugin.version = "3.11.0"
            
            log.info("Attempting to load maven-compiler-plugin descriptor...")
            
            val repositories = project.remotePluginRepositories ?: emptyList()
            debug["repositories.count"] = repositories.size
            debug["repositories.first"] = repositories.firstOrNull()?.toString() ?: "none"
            
            try {
                val descriptor = pluginManager.getPluginDescriptor(
                    compilerPlugin,
                    repositories,
                    session.repositorySession
                )
                
                debug["pluginDescriptor.loaded"] = descriptor != null
                debug["pluginDescriptor.mojoCount"] = descriptor?.mojos?.size ?: 0
                debug["pluginDescriptor.version"] = descriptor?.version ?: "unknown"
                
                if (descriptor != null) {
                    val compileMojo = descriptor.getMojo("compile")
                    debug["compileMojo.available"] = compileMojo != null
                    debug["compileMojo.parameterCount"] = compileMojo?.parameters?.size ?: 0
                    
                    compileMojo?.parameters?.take(5)?.forEach { param ->
                        log.info("Parameter: ${param.name} (${param.type}) = ${param.expression ?: param.defaultValue}")
                    }
                }
                
            } catch (e: Exception) {
                debug["pluginDescriptor.error"] = e.javaClass.simpleName
                debug["pluginDescriptor.errorMessage"] = e.message ?: "unknown"
                log.warn("Plugin descriptor loading failed: ${e.message}", e)
            }
            
            // Check if we can get plugin version resolver
            try {
                val versionResolver = session.container?.lookup(org.apache.maven.plugin.version.PluginVersionResolver::class.java)
                debug["pluginVersionResolver.available"] = versionResolver != null
            } catch (e: Exception) {
                debug["pluginVersionResolver.error"] = e.message ?: "unknown error"
            }
            
        } catch (e: Exception) {
            debug["debug.error"] = e.message ?: "unknown error"
            log.error("Debug investigation failed", e)
        }
        
        return debug
    }
}