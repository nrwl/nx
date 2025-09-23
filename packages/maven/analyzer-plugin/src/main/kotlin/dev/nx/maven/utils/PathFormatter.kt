package dev.nx.maven.utils

import dev.nx.maven.GitIgnoreClassifier
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Handles path resolution, Maven command detection, and input/output path formatting for Nx
 */
class PathFormatter(
    private val gitIgnoreClassifier: GitIgnoreClassifier,
) {

    private val log: Logger = LoggerFactory.getLogger(PathFormatter::class.java)

    fun formatInputPath(path: File, projectRoot: File): String {

        return toProjectPath(path, projectRoot)
    }

    fun toDependentTaskOutputs(path: File, projectRoot: File): DependentTaskOutputs {
        val relativePath = path.relativeTo(projectRoot)
        // TODO: This is supposed to be an dependent task outputs
        return DependentTaskOutputs(relativePath.path)
    }

    fun formatOutputPath(path: File, projectRoot: File): String {
        return toProjectPath(path, projectRoot)
    }

    fun toProjectPath(path: File, projectRoot: File): String {
        val relativePath = path.relativeTo(projectRoot)

        return "{projectRoot}/$relativePath"
    }
}

data class DependentTaskOutputs(val path: String, val transitive: Boolean = true)
