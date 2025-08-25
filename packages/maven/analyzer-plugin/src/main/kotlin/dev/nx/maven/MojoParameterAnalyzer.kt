package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Analyzes Maven mojo parameters to determine inputs and outputs
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
        
        when {
            isInputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    pathResolver.addInputPath(path, inputs)
                }
            }
            isOutputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    pathResolver.addOutputPath(path, outputs)
                }
            }
        }
    }
    
    /**
     * Determines if a parameter represents an input to the mojo
     */
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
    
    /**
     * Determines if a parameter represents an output from the mojo
     */
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
    
    /**
     * Determines if a mojo has side effects that prevent caching
     */
    fun isSideEffectMojo(mojo: MojoDescriptor): Boolean {
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
}