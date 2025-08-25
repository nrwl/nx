package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import java.io.File

/**
 * Handles path resolution and input/output path formatting for Nx
 */
class PathResolver(
    private val workspaceRoot: String
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
        if (file.exists()) {
            // External dependencies (like JARs from .m2/repository) should remain as absolute paths
            if (isExternalDependency(path)) {
                inputs.add(path)
            } else {
                val projectPath = toProjectPath(path)
                if (file.isDirectory) {
                    inputs.add("$projectPath/**/*")
                } else {
                    inputs.add(projectPath)
                }
            }
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
     * Adds an output path to the outputs array
     */
    fun addOutputPath(path: String, outputs: ArrayNode) {
        outputs.add(toProjectPath(path))
    }
    
    /**
     * Converts an absolute path to a project-relative path using Nx token format
     */
    fun toProjectPath(path: String): String = try {
        val workspaceRootPath = java.nio.file.Paths.get(workspaceRoot)
        val filePath = java.nio.file.Paths.get(path)
        val relativePath = workspaceRootPath.relativize(filePath)
        "{projectRoot}/$relativePath".replace("\\", "/")
    } catch (e: Exception) {
        "{projectRoot}/$path"
    }
}