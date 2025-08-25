package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import java.io.File

/**
 * Handles path resolution and input/output path formatting for Nx
 */
class PathResolver(
    private val workspaceRoot: String,
    private val projectBaseDir: String? = null
) {
    
    /**
     * Adds an input path to the inputs array, checking existence and formatting appropriately
     */
    fun addInputPath(path: String, inputs: ArrayNode) {
        // Handle classpath-style paths (multiple paths separated by : or ;)
        val pathSeparator = System.getProperty("path.separator")
        if (path.contains(pathSeparator)) {
            // Split classpath and add each path individually
            path.split(pathSeparator).forEach { singlePath ->
                if (singlePath.isNotBlank()) {
                    addSingleInputPath(singlePath.trim(), inputs)
                }
            }
        } else {
            addSingleInputPath(path, inputs)
        }
    }
    
    /**
     * Adds a single input path to the inputs array
     */
    private fun addSingleInputPath(path: String, inputs: ArrayNode) {
        val file = File(path)
        println("DEBUG PathResolver: checking path '$path', exists=${file.exists()}")
        if (file.exists()) {
            println("DEBUG PathResolver: path exists, checking dependency type...")
            // TODO: External dependencies (like JARs from .m2/repository) are not yet supported by Nx
            // as cache inputs. For now, we exclude them to avoid Nx errors. When Nx supports external
            // file dependencies, we should include them as: inputs.add(path)
            // This is important for proper cache invalidation when external dependencies change.
            if (isExternalDependency(path)) {
                println("DEBUG PathResolver: skipping external dependency: $path")
                // Skip external dependencies for now - Nx doesn't support them yet
                return
            } else if (isInterProjectDependency(path)) {
                println("DEBUG PathResolver: adding inter-project dependency: $path")
                // Inter-project dependency JAR - include as workspace input
                val projectPath = toProjectPath(path)
                inputs.add(projectPath)
            } else {
                val projectPath = toProjectPath(path)
                if (file.isDirectory) {
                    println("DEBUG PathResolver: adding directory input: $projectPath/**/*")
                    inputs.add("$projectPath/**/*")
                } else {
                    println("DEBUG PathResolver: adding file input: $projectPath")
                    inputs.add(projectPath)
                }
            }
        } else {
            println("DEBUG PathResolver: path does NOT exist, skipping: $path")
        }
    }
    
    /**
     * Checks if a path is an external dependency (JAR file outside the workspace)
     */
    private fun isExternalDependency(path: String): Boolean {
        val file = File(path)
        return (file.name.endsWith(".jar") || file.name.endsWith(".war") || file.name.endsWith(".ear")) &&
               !path.startsWith(workspaceRoot)
    }
    
    /**
     * Checks if a path is an inter-project dependency (output directory or JAR within the workspace)
     */
    private fun isInterProjectDependency(path: String): Boolean {
        if (!path.startsWith(workspaceRoot)) return false
        
        val file = File(path)
        // Inter-project dependencies can be:
        // 1. JAR files within workspace (built artifacts)
        // 2. target/classes directories (direct classpath references)
        return (file.name.endsWith(".jar") || file.name.endsWith(".war") || file.name.endsWith(".ear")) ||
               (path.contains("/target/classes") || path.contains("/target/test-classes"))
    }
    
    /**
     * Adds an output path to the outputs array
     */
    fun addOutputPath(path: String, outputs: ArrayNode) {
        outputs.add(toProjectPath(path))
    }
    
    /**
     * Converts an absolute path to a project-relative path using Nx token format
     */
    fun toProjectPath(path: String): String = try {
        val filePath = java.nio.file.Paths.get(path)
        
        // If we have a project base directory, make paths relative to the project root
        // This ensures {projectRoot} refers to the individual project's directory, not workspace root
        val baseDirPath = if (projectBaseDir != null) {
            java.nio.file.Paths.get(projectBaseDir)
        } else {
            java.nio.file.Paths.get(workspaceRoot)
        }
        
        val relativePath = baseDirPath.relativize(filePath)
        "{projectRoot}/$relativePath".replace("\\", "/")
    } catch (e: Exception) {
        "{projectRoot}/$path"
    }
}