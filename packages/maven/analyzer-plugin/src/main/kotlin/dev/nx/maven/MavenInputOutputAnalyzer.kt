package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.logging.Log
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.artifact.Artifact
import org.apache.maven.artifact.DefaultArtifact
import org.apache.maven.artifact.handler.DefaultArtifactHandler
import org.apache.maven.plugin.version.PluginVersionRequest
import org.apache.maven.plugin.version.DefaultPluginVersionRequest
import org.apache.maven.plugin.version.PluginVersionResult
import org.apache.maven.plugin.version.PluginVersionResolver
import org.apache.maven.artifact.repository.ArtifactRepository
import org.eclipse.aether.repository.RemoteRepository
import java.io.File

class MavenInputOutputAnalyzer(
    private val objectMapper: ObjectMapper,
    private val workspaceRoot: String,
    private val log: Log,
    private val session: MavenSession,
    private val pluginManager: MavenPluginManager
) {
    
    // Cache for loaded plugin descriptors to avoid repeated resolution
    private val pluginDescriptorCache = mutableMapOf<String, PluginDescriptor?>()
    data class CacheabilityDecision(val cacheable: Boolean, val reason: String, val inputs: ArrayNode, val outputs: ArrayNode)
    
    fun analyzeCacheability(phase: String, project: MavenProject): CacheabilityDecision {
        log.debug("Analyzing phase '$phase' for project ${project.artifactId}")
        
        val inputs = objectMapper.createArrayNode()
        val outputs = objectMapper.createArrayNode()
        var hasSideEffects = false
        
        // Always include POM as input
        inputs.add("{projectRoot}/pom.xml")
        
        // Find all plugin executions for this phase
        val executions = findExecutionsForPhase(phase, project)
        
        if (executions.isEmpty()) {
            return CacheabilityDecision(false, "No plugin executions found for phase '$phase'", inputs, outputs)
        }
        
        // Analyze each execution
        for ((plugin, goals) in executions) {
            try {
                val pluginDescriptor = loadPluginDescriptor(plugin, project)
                if (pluginDescriptor != null) {
                    for (goal in goals) {
                        val mojo = pluginDescriptor.getMojo(goal)
                        if (mojo != null) {
                            log.debug("Analyzing mojo ${plugin.artifactId}:$goal")
                            analyzeMojo(mojo, project, inputs, outputs)
                            if (isSideEffectMojo(mojo)) {
                                hasSideEffects = true
                                log.debug("Mojo ${plugin.artifactId}:$goal has side effects")
                            }
                        } else {
                            log.warn("Could not find mojo descriptor for goal $goal in plugin ${plugin.artifactId}")
                        }
                    }
                } else {
                    log.warn("Could not load plugin descriptor for ${plugin.artifactId}")
                    // Without mojo descriptor, we can't analyze properly
                    return CacheabilityDecision(false, "Plugin descriptor unavailable for ${plugin.artifactId}", inputs, outputs)
                }
            } catch (e: Exception) {
                log.warn("Failed to analyze plugin ${plugin.artifactId}: ${e.message}")
                return CacheabilityDecision(false, "Failed to analyze plugin ${plugin.artifactId}", inputs, outputs)
            }
        }
        
        val cacheable = !hasSideEffects && inputs.size() > 1
        val reason = when {
            hasSideEffects -> "Phase has side effects"
            inputs.size() <= 1 -> "Phase has no meaningful inputs"
            else -> "Phase is cacheable"
        }
        
        log.debug("Phase '$phase' analysis: cacheable=$cacheable, inputs=${inputs.size()}, outputs=${outputs.size()}")
        return CacheabilityDecision(cacheable, reason, inputs, outputs)
    }
    
    private fun findExecutionsForPhase(phase: String, project: MavenProject): List<Pair<org.apache.maven.model.Plugin, List<String>>> {
        val results = mutableListOf<Pair<org.apache.maven.model.Plugin, List<String>>>()
        
        for (plugin in project.buildPlugins) {
            val goals = mutableListOf<String>()
            
            // Check explicit executions
            for (execution in plugin.executions) {
                if (execution.phase == phase) {
                    goals.addAll(execution.goals)
                }
            }
            
            // Check default phase bindings for plugins without explicit phase
            if (goals.isEmpty()) {
                val defaultGoals = getDefaultGoalsForPhase(plugin.artifactId, phase)
                goals.addAll(defaultGoals)
            }
            
            if (goals.isNotEmpty()) {
                results.add(plugin to goals)
            }
        }
        
        return results
    }
    
    private fun getDefaultGoalsForPhase(artifactId: String, phase: String): List<String> {
        return when (artifactId to phase) {
            "maven-compiler-plugin" to "compile" -> listOf("compile")
            "maven-compiler-plugin" to "test-compile" -> listOf("testCompile")
            "maven-surefire-plugin" to "test" -> listOf("test")
            "maven-failsafe-plugin" to "integration-test" -> listOf("integration-test")
            "maven-jar-plugin" to "package" -> listOf("jar")
            "maven-war-plugin" to "package" -> listOf("war")
            "maven-ear-plugin" to "package" -> listOf("ear")
            "maven-clean-plugin" to "clean" -> listOf("clean")
            "maven-install-plugin" to "install" -> listOf("install")
            "maven-deploy-plugin" to "deploy" -> listOf("deploy")
            else -> emptyList()
        }
    }
    
    private fun loadPluginDescriptor(plugin: org.apache.maven.model.Plugin, project: MavenProject): PluginDescriptor? {
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
            // First try to get version from plugin management
            val managedVersion = project.pluginManagement?.plugins?.find { 
                it.artifactId == plugin.artifactId && 
                (it.groupId ?: "org.apache.maven.plugins") == (plugin.groupId ?: "org.apache.maven.plugins")
            }?.version
            
            if (managedVersion != null) {
                log.debug("Found managed version $managedVersion for ${plugin.artifactId}")
                return managedVersion
            }
            
            // Try to use Maven's plugin version resolver if available
            val pluginVersionResolver = getPluginVersionResolver()
            if (pluginVersionResolver != null) {
                val versionRequest = createPluginVersionRequest(plugin, project)
                val versionResult = pluginVersionResolver.resolve(versionRequest)
                log.debug("Plugin version resolver returned ${versionResult.version} for ${plugin.artifactId}")
                return versionResult.version
            }
            
            // Fall back to default versions for well-known plugins
            val defaultVersion = getDefaultPluginVersion(plugin.artifactId)
            log.debug("Using default version $defaultVersion for ${plugin.artifactId}")
            return defaultVersion
            
        } catch (e: Exception) {
            log.debug("Error resolving plugin version for ${plugin.artifactId}: ${e.message}")
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
    
    private fun analyzeMojo(mojo: MojoDescriptor, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode) {
        // Analyze mojo parameters to find inputs and outputs
        for (param in mojo.parameters ?: emptyList()) {
            analyzeParameter(param, project, inputs, outputs)
        }
    }
    
    private fun analyzeParameter(param: Parameter, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode) {
        val name = param.name ?: return
        val type = param.type ?: return
        val defaultValue = param.defaultValue
        val expression = param.expression
        
        when {
            isInputParameter(name, type, param) -> {
                val path = resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    addInputPath(path, inputs)
                }
            }
            isOutputParameter(name, type, param) -> {
                val path = resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    addOutputPath(path, outputs)
                }
            }
        }
    }
    
    private fun isInputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check for exact input parameter names
        val exactInputNames = setOf(
            "sourceDirectory", "testSourceDirectory", "sources", "sourceRoot", "sourceRoots",
            "compileSourceRoots", "testCompileSourceRoots", "resources", "testResources",
            "classesDirectory", "testClassesDirectory", "inputDirectory", "workingDirectory",
            "basedir", "projectDirectory", "includes", "excludes", "additionalClasspathElements",
            "classpathElements", "testClasspathElements", "dependencyClasspathElements"
        )
        
        if (exactInputNames.contains(name)) return true
        
        // Check for input parameter name patterns
        val inputPatterns = listOf(
            "source", "input", "classpath", "classes", "resource", "config", "properties", 
            "descriptor", "manifest", "template", "schema", "definition"
        )
        
        val nameIsInput = inputPatterns.any { pattern -> 
            name.contains(pattern, ignoreCase = true) && 
            (name.contains("directory", ignoreCase = true) || name.contains("file", ignoreCase = true) || name.contains("path", ignoreCase = true))
        }
        
        if (nameIsInput) return true
        
        // Check type patterns for Files and Lists that suggest inputs
        when {
            type.contains("java.io.File") && inputPatterns.any { name.contains(it, ignoreCase = true) } -> return true
            type.contains("java.nio.file.Path") && inputPatterns.any { name.contains(it, ignoreCase = true) } -> return true
            type.contains("List<File>") || type.contains("List<String>") -> {
                if (inputPatterns.any { name.contains(it, ignoreCase = true) }) return true
            }
            type.contains("Set<File>") || type.contains("Set<String>") -> {
                if (inputPatterns.any { name.contains(it, ignoreCase = true) }) return true
            }
        }
        
        // Exclude common output patterns to avoid false positives
        val outputPatterns = listOf("output", "target", "destination", "report", "artifact", "deploy", "install")
        if (outputPatterns.any { name.contains(it, ignoreCase = true) }) return false
        
        return false
    }
    
    private fun isOutputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check for exact output parameter names
        val exactOutputNames = setOf(
            "outputDirectory", "testOutputDirectory", "targetDirectory", "buildDirectory",
            "outputFile", "targetFile", "reportsDirectory", "reportOutputDirectory",
            "artifactFile", "finalName", "jarFile", "warFile", "destinationDir",
            "reportOutputFile", "destinationFile", "archiveFile"
        )
        
        if (exactOutputNames.contains(name)) return true
        
        // Check for output parameter name patterns
        val outputPatterns = listOf(
            "output", "target", "destination", "build", "artifact", "archive", 
            "report", "generated", "compiled", "packaged", "deploy", "install"
        )
        
        val nameIsOutput = outputPatterns.any { pattern -> 
            name.contains(pattern, ignoreCase = true) && 
            (name.contains("directory", ignoreCase = true) || 
             name.contains("file", ignoreCase = true) || 
             name.contains("path", ignoreCase = true) ||
             name.endsWith("Dir") ||
             name.endsWith("File"))
        }
        
        if (nameIsOutput) return true
        
        // Check type patterns for Files that suggest outputs
        when {
            type.contains("java.io.File") && outputPatterns.any { name.contains(it, ignoreCase = true) } -> return true
            type.contains("java.nio.file.Path") && outputPatterns.any { name.contains(it, ignoreCase = true) } -> return true
        }
        
        // Special cases for common Maven plugin patterns
        when {
            // JAR plugin patterns
            name.equals("jarFile", ignoreCase = true) || name.equals("outputFile", ignoreCase = true) -> return true
            // Surefire/Failsafe report patterns  
            name.contains("reportsDirectory", ignoreCase = true) -> return true
            // Compiler plugin output
            name.equals("outputDirectory", ignoreCase = true) -> return true
            // Site plugin
            name.contains("siteDirectory", ignoreCase = true) -> return true
        }
        
        // Exclude common input patterns to avoid false positives
        val inputPatterns = listOf("source", "input", "classpath", "resource")
        if (inputPatterns.any { name.contains(it, ignoreCase = true) }) return false
        
        return false
    }
    
    private fun resolveParameterValue(name: String, defaultValue: String?, expression: String?, project: MavenProject): String? {
        // Try expression first
        expression?.let { expr ->
            val resolved = resolveExpression(expr, project)
            if (resolved != expr) return resolved
        }
        
        // Try default value
        defaultValue?.let { default ->
            return resolveExpression(default, project)
        }
        
        // Try known parameter mappings
        return when (name) {
            "sourceDirectory" -> project.compileSourceRoots.firstOrNull()
            "testSourceDirectory" -> project.testCompileSourceRoots.firstOrNull()
            "outputDirectory" -> project.build.outputDirectory
            "testOutputDirectory" -> project.build.testOutputDirectory
            "buildDirectory" -> project.build.directory
            else -> null
        }
    }
    
    private fun resolveExpression(expression: String, project: MavenProject): String {
        var result = expression
        
        // Project build properties
        result = result.replace("\${project.build.directory}", project.build.directory ?: "\${project.basedir}/target")
        result = result.replace("\${project.build.outputDirectory}", project.build.outputDirectory ?: "\${project.build.directory}/classes")
        result = result.replace("\${project.build.testOutputDirectory}", project.build.testOutputDirectory ?: "\${project.build.directory}/test-classes")
        result = result.replace("\${project.build.sourceDirectory}", project.build.sourceDirectory ?: "\${project.basedir}/src/main/java")
        result = result.replace("\${project.build.testSourceDirectory}", project.build.testSourceDirectory ?: "\${project.basedir}/src/test/java")
        result = result.replace("\${project.build.finalName}", project.build.finalName ?: "\${project.artifactId}-\${project.version}")
        
        // Project properties
        result = result.replace("\${project.basedir}", project.basedir?.absolutePath ?: ".")
        result = result.replace("\${basedir}", project.basedir?.absolutePath ?: ".")
        result = result.replace("\${project.artifactId}", project.artifactId ?: "unknown")
        result = result.replace("\${project.groupId}", project.groupId ?: "unknown")
        result = result.replace("\${project.version}", project.version ?: "unknown")
        result = result.replace("\${project.name}", project.name ?: project.artifactId ?: "unknown")
        result = result.replace("\${project.packaging}", project.packaging ?: "jar")
        
        // Maven session properties
        result = result.replace("\${session.executionRootDirectory}", session.executionRootDirectory ?: ".")
        
        // Common Maven properties
        result = result.replace("\${maven.build.timestamp.format}", "yyyyMMdd-HHmm")
        
        // Recursively resolve nested expressions (max 5 levels to avoid infinite loops)
        var previousResult = result
        repeat(5) {
            result = result
                .replace("\${project.build.directory}", project.build.directory ?: "\${project.basedir}/target")
                .replace("\${project.basedir}", project.basedir?.absolutePath ?: ".")
                .replace("\${basedir}", project.basedir?.absolutePath ?: ".")
                
            if (result == previousResult) return@repeat // No more changes
            previousResult = result
        }
        
        return result
    }
    
    private fun addInputPath(path: String, inputs: ArrayNode) {
        val file = File(path)
        if (file.exists()) {
            val projectPath = toProjectPath(path)
            if (file.isDirectory) {
                inputs.add("$projectPath/**/*")
            } else {
                inputs.add(projectPath)
            }
        }
    }
    
    private fun addOutputPath(path: String, outputs: ArrayNode) {
        outputs.add(toProjectPath(path))
    }
    
    private fun isSideEffectMojo(mojo: MojoDescriptor): Boolean {
        val goal = mojo.goal?.lowercase() ?: ""
        val description = mojo.description?.lowercase() ?: ""
        
        val sideEffectKeywords = setOf(
            "install", "deploy", "clean", "delete", "remove", "publish", "upload",
            "commit", "push", "modify", "write", "create", "execute"
        )
        
        return sideEffectKeywords.any { keyword ->
            goal.contains(keyword) || description.contains(keyword)
        }
    }
    
    private fun getDefaultPluginVersion(artifactId: String): String = when (artifactId) {
        "maven-compiler-plugin" -> "3.11.0"
        "maven-surefire-plugin" -> "3.0.0"
        "maven-failsafe-plugin" -> "3.0.0"
        "maven-jar-plugin" -> "3.3.0"
        "maven-war-plugin" -> "3.3.0"
        "maven-ear-plugin" -> "3.3.0"
        "maven-clean-plugin" -> "3.2.0"
        "maven-install-plugin" -> "3.1.0"
        "maven-deploy-plugin" -> "3.1.0"
        else -> "LATEST"
    }
    
    private fun toProjectPath(path: String): String = try {
        val workspaceRootPath = java.nio.file.Paths.get(workspaceRoot)
        val filePath = java.nio.file.Paths.get(path)
        val relativePath = workspaceRootPath.relativize(filePath)
        "{projectRoot}/$relativePath".replace("\\", "/")
    } catch (e: Exception) {
        "{projectRoot}/$path"
    }
}