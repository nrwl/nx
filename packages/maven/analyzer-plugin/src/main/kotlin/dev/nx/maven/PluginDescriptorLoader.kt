package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject
import org.apache.maven.artifact.Artifact
import org.apache.maven.artifact.DefaultArtifact
import org.apache.maven.artifact.handler.DefaultArtifactHandler
import org.apache.maven.plugin.version.PluginVersionRequest
import org.apache.maven.plugin.version.DefaultPluginVersionRequest
import org.apache.maven.plugin.version.PluginVersionResolver
import org.apache.maven.artifact.repository.ArtifactRepository
import org.eclipse.aether.repository.RemoteRepository

/**
 * Handles loading and resolving Maven plugin descriptors
 */
class PluginDescriptorLoader(
    private val log: Log,
    private val session: MavenSession,
    private val pluginManager: MavenPluginManager
) {
    
    // Cache for loaded plugin descriptors to avoid repeated resolution
    private val pluginDescriptorCache = mutableMapOf<String, PluginDescriptor?>()
    
    /**
     * Loads a plugin descriptor for the given plugin, with caching and version resolution
     */
    fun loadPluginDescriptor(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor? {
        val groupId = plugin.groupId ?: "org.apache.maven.plugins"
        val artifactId = plugin.artifactId
        val version = plugin.version
        
        // Create cache key
        val pluginKey = "$groupId:$artifactId:${version ?: "default"}"
        
        // Check cache first
        pluginDescriptorCache[pluginKey]?.let { return it }
        
        return try {
            log.debug("Loading plugin descriptor for $groupId:$artifactId:${version ?: "resolving version"}")
            
            // Step 1: Resolve version if not specified
            val resolvedVersion = version ?: resolvePluginVersion(plugin, project)
            if (resolvedVersion == null) {
                log.warn("Could not resolve version for plugin $groupId:$artifactId")
                pluginDescriptorCache[pluginKey] = null
                return null
            }
            
            log.debug("Resolved plugin version: $groupId:$artifactId:$resolvedVersion")
            
            // Step 2: Create plugin artifact
            val pluginArtifact = createPluginArtifact(groupId, artifactId, resolvedVersion)
            
            // Step 3: Create resolved plugin and get descriptor using Maven's plugin manager
            val resolvedPlugin = org.apache.maven.model.Plugin()
            resolvedPlugin.groupId = groupId
            resolvedPlugin.artifactId = artifactId
            resolvedPlugin.version = resolvedVersion
            
            val descriptor = getPluginDescriptorFromManager(resolvedPlugin, project)
            
            // Cache result
            pluginDescriptorCache[pluginKey] = descriptor
            
            if (descriptor != null) {
                log.debug("Successfully loaded plugin descriptor for $groupId:$artifactId:$resolvedVersion with ${descriptor.mojos?.size ?: 0} mojos")
            } else {
                log.debug("Plugin descriptor not found for $groupId:$artifactId:$resolvedVersion")
            }
            
            descriptor
            
        } catch (e: Exception) {
            log.warn("Failed to load plugin descriptor for $groupId:$artifactId: ${e.message}", e)
            pluginDescriptorCache[pluginKey] = null
            null
        }
    }
    
    private fun resolvePluginVersion(plugin: org.apache.maven.model.Plugin, project: MavenProject): String? {
        return try {
            log.debug("Resolving version for plugin ${plugin.artifactId}")
            
            // Try plugin management first
            project.pluginManagement?.plugins?.find { 
                it.artifactId == plugin.artifactId && 
                (it.groupId == plugin.groupId || (plugin.groupId == null && it.groupId == "org.apache.maven.plugins"))
            }?.version?.let { return it }
            
            // Try using PluginVersionResolver
            val versionResolver = getPluginVersionResolver()
            if (versionResolver != null) {
                val request = createPluginVersionRequest(plugin, project)
                val result = versionResolver.resolve(request)
                return result.version
            }
            
            // Fallback to default versions for common plugins
            getDefaultPluginVersion(plugin.artifactId)
            
        } catch (e: Exception) {
            log.debug("Could not resolve plugin version for ${plugin.artifactId}: ${e.message}")
            getDefaultPluginVersion(plugin.artifactId)
        }
    }
    
    private fun createPluginArtifact(groupId: String, artifactId: String, version: String): Artifact {
        val handler = DefaultArtifactHandler("maven-plugin")
        return DefaultArtifact(groupId, artifactId, version, "compile", "maven-plugin", null, handler)
    }
    
    private fun getPluginDescriptorFromManager(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor? {
        return try {
            // Use Maven's plugin manager to get the descriptor
            // Convert Maven model Plugin to the format needed by PluginManager
            val repositories = project.remotePluginRepositories ?: emptyList<RemoteRepository>()
            
            pluginManager.getPluginDescriptor(
                plugin,
                repositories,
                session.repositorySession
            )
        } catch (e: Exception) {
            log.debug("Plugin manager failed to get descriptor for ${plugin.artifactId}: ${e.message}")
            null
        }
    }
    
    private fun getPluginVersionResolver(): PluginVersionResolver? {
        return try {
            // Try to get plugin version resolver from session/container
            session.container?.lookup(PluginVersionResolver::class.java)
        } catch (e: Exception) {
            log.debug("Could not get PluginVersionResolver: ${e.message}")
            null
        }
    }
    
    private fun createPluginVersionRequest(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginVersionRequest {
        val request = DefaultPluginVersionRequest()
        request.groupId = plugin.groupId ?: "org.apache.maven.plugins"
        request.artifactId = plugin.artifactId
        request.repositorySession = session.repositorySession
        request.repositories = project.remotePluginRepositories ?: emptyList<RemoteRepository>()
        return request
    }
    
    private fun getDefaultPluginVersion(artifactId: String): String = when (artifactId) {
        "maven-compiler-plugin" -> "3.11.0"
        "maven-surefire-plugin" -> "3.0.0"
        "maven-failsafe-plugin" -> "3.0.0"
        "maven-jar-plugin" -> "3.3.0"
        "maven-war-plugin" -> "3.3.0"
        "maven-ear-plugin" -> "3.2.0"
        "maven-clean-plugin" -> "3.2.0"
        "maven-install-plugin" -> "3.1.1"
        "maven-deploy-plugin" -> "3.1.1"
        "maven-site-plugin" -> "4.0.0-M4"
        "maven-resources-plugin" -> "3.3.0"
        else -> "3.0.0" // Generic fallback
    }
}