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