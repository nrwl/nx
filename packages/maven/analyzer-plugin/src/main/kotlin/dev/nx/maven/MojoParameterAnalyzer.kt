package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Analyzes Maven mojo parameters to determine inputs, outputs, and cacheability
 */
class MojoParameterAnalyzer(
    private val log: Log,
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver
) {
    
    /**
     * Analyzes a mojo's parameters to find inputs and outputs
     */
    fun analyzeMojo(mojo: MojoDescriptor, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode) {
        
        // Analyze mojo parameters to find inputs and outputs
        for (param in mojo.parameters ?: emptyList()) {
            analyzeParameter(param, project, inputs, outputs)
        }
    }
    
    /**
     * Analyzes a single mojo parameter to determine if it's an input or output
     */
    private fun analyzeParameter(param: Parameter, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode) {
        val name = param.name ?: return
        val type = param.type ?: return
        val defaultValue = param.defaultValue
        val expression = param.expression
        
        log.info("Analyzing parameter: name=$name, type=$type, defaultValue=$defaultValue, expression=$expression")
        
        when {
            isInputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    log.debug("Adding input path: $path (from parameter $name)")
                    pathResolver.addInputPath(path, inputs)
                } else {
                    log.debug("Parameter $name resolved to null path")
                }
            }
            isOutputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    log.debug("Adding output path: $path (from parameter $name)")
                    pathResolver.addOutputPath(path, outputs)
                } else {
                    log.debug("Parameter $name resolved to null path")
                }
            }
            else -> {
                log.debug("Parameter $name is neither input nor output")
            }
        }
    }
    
    /**
     * Determines if a parameter represents an input (source files, resources, dependencies, etc.)
     */
    private fun isInputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check parameter name patterns for inputs
        val inputNamePatterns = listOf(
            // Source directories
            "sourceDirectory", "sourceDirs", "sourceRoots", "compileSourceRoots",
            "testSourceDirectory", "testSourceRoots", "testCompileSourceRoots",
            
            // Resource directories
            "resourceDirectory", "resources", "testResources", "webappDirectory",
            
            // Classpath elements
            "classpathElements", "compileClasspathElements", "testClasspathElements",
            "runtimeClasspathElements", "systemPath", "compileClasspath", "runtimeClasspath",
            
            // Input files
            "inputFile", "inputFiles", "sourceFile", "sourceFiles", "includes", "include",
            "configLocation", "configFile", "rulesFile", "suppressionsFile",
            
            // Maven coordinates for dependencies
            "groupId", "artifactId", "classifier", "scope",
            
            // Web application sources
            "warSourceDirectory", "webXml", "containerConfigXML",
            
            // Other specific input patterns (removed overly broad basedir/workingDirectory/projectDirectory)
            "generatedSourcesDirectory", "generatedTestSourcesDirectory"
        )
        
        // Check if parameter name matches input patterns
        val nameMatch = inputNamePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }
        
        // Check parameter type for input types
        val inputTypePatterns = listOf(
            "java.io.File", "java.util.List", "java.util.Set", 
            "java.lang.String", "java.nio.file.Path"
        )
        
        val typeMatch = inputTypePatterns.any { pattern ->
            type.contains(pattern, ignoreCase = true)
        }
        
        // Additional checks based on parameter characteristics
        val isReadable = param.description?.contains("read", ignoreCase = true) == true ||
                        param.description?.contains("source", ignoreCase = true) == true ||
                        param.description?.contains("input", ignoreCase = true) == true
        
        // Parameters that are clearly not inputs
        val excludePatterns = listOf(
            "outputDirectory", "targetDirectory", "buildDirectory", "destinationFile",
            "outputFile", "target", "destination", "finalName"
        )
        
        val isExcluded = excludePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }
        
        val result = (nameMatch || isReadable) && typeMatch && !isExcluded
        
        
        return result
    }
    
    /**
     * Determines if a parameter represents an output (target directories, generated files, etc.)
     */
    private fun isOutputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check parameter name patterns for outputs
        val outputNamePatterns = listOf(
            // Output directories
            "outputDirectory", "targetDirectory", "buildDirectory", "destinationDir",
            "testOutputDirectory", "generatedSourcesDirectory",
            
            // Output files
            "outputFile", "destinationFile", "targetFile", "finalName",
            "jarName", "warName", "earName",
            
            // Report directories
            "reportOutputDirectory", "reportsDirectory", "outputFormat",
            
            // Generated content
            "generatedSources", "generatedResources", "generatedClasses",
            
            // Archive outputs
            "archiveFile", "archiveName", "packagedFile"
        )
        
        // Check if parameter name matches output patterns
        val nameMatch = outputNamePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }
        
        // Check parameter type for output types
        val outputTypePatterns = listOf(
            "java.io.File", "java.lang.String", "java.nio.file.Path"
        )
        
        val typeMatch = outputTypePatterns.any { pattern ->
            type.contains(pattern, ignoreCase = true)
        }
        
        // Additional checks based on parameter characteristics
        val isWritable = param.description?.contains("output", ignoreCase = true) == true ||
                        param.description?.contains("target", ignoreCase = true) == true ||
                        param.description?.contains("destination", ignoreCase = true) == true ||
                        param.description?.contains("generate", ignoreCase = true) == true
        
        val result = (nameMatch || isWritable) && typeMatch
        
        
        return result
    }
    
    /**
     * Determines if a mojo has side effects that would make it non-cacheable
     * Uses comprehensive analysis of mojo metadata, annotations, and parameters
     */
    fun isSideEffectMojo(mojo: MojoDescriptor): Boolean {
        // Check Maven @Mojo annotation properties
        if (hasAnnotationBasedSideEffects(mojo)) {
            return true
        }
        
        // Check parameter-level side effects
        if (hasParameterBasedSideEffects(mojo)) {
            return true
        }
        
        // Fallback to goal and plugin pattern matching
        return hasPatternBasedSideEffects(mojo)
    }
    
    /**
     * Checks for side effects based on Maven @Mojo annotation properties
     */
    private fun hasAnnotationBasedSideEffects(mojo: MojoDescriptor): Boolean {
        // Non-thread-safe mojos may have concurrency issues but aren't necessarily non-cacheable
        // However, aggregator mojos typically have cross-project side effects
        if (isMojoAggregator(mojo)) {
            log.debug("Mojo ${mojo.goal} is aggregator - potential side effects")
            return true
        }
        
        return false
    }
    
    /**
     * Checks for side effects based on mojo parameters
     */
    private fun hasParameterBasedSideEffects(mojo: MojoDescriptor): Boolean {
        val parameters = mojo.parameters ?: return false
        
        for (param in parameters) {
            if (isParameterWithSideEffects(param)) {
                log.debug("Mojo ${mojo.goal} has side-effect parameter: ${param.name}")
                return true
            }
        }
        
        return false
    }
    
    /**
     * Fallback pattern-based side effect detection
     */
    private fun hasPatternBasedSideEffects(mojo: MojoDescriptor): Boolean {
        val goal = mojo.goal
        val artifactId = mojo.pluginDescriptor.artifactId
        
        // Known side-effect goals
        val sideEffectGoals = setOf(
            // Deployment and installation
            "deploy", "install", "release",
            
            // External system interactions
            "exec", "run", "start", "stop",
            
            // Network operations
            "upload", "download", "push", "pull",
            
            // Database operations
            "migrate", "create", "drop", "update"
        )
        
        val sideEffectPlugins = setOf(
            "maven-deploy-plugin",
            "maven-install-plugin", 
            "maven-release-plugin",
            "exec-maven-plugin",
            "spring-boot-maven-plugin",
            "docker-maven-plugin"
        )
        
        return sideEffectGoals.contains(goal) || 
               sideEffectPlugins.contains(artifactId) ||
               goal.contains("deploy", ignoreCase = true) ||
               goal.contains("install", ignoreCase = true) ||
               goal.contains("release", ignoreCase = true)
    }
}