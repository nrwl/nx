package dev.nx.maven.buildstate

import org.slf4j.Logger
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

/**
 * Utility class for converting between absolute and relative paths
 */
object PathUtils {

    /**
     * Convert an absolute path to a relative path from the project root
     *
     * @param absolutePath The absolute path to convert
     * @param projectRoot The project root directory
     * @param logger Optional logger for warnings
     * @return The relative path from project root, or the original path if conversion fails
     */
    fun toRelativePath(absolutePath: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val absFile = File(absolutePath)
            val absPath = absFile.canonicalPath
            val rootPath = projectRoot.canonicalPath

            val relPath = Paths.get(rootPath).relativize(Paths.get(absPath)).toString()
            relPath
        } catch (e: Exception) {
            logger?.warn("Failed to convert absolute path to relative: $absolutePath, using absolute path")
            absolutePath
        }
    }

    /**
     * Convert a relative path to an absolute path based on the project root
     *
     * @param pathString The path string (could be relative or absolute)
     * @param projectRoot The project root directory
     * @param logger Optional logger for warnings
     * @return The absolute path
     */
    fun toAbsolutePath(pathString: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val path = File(pathString)
            val absPath = if (path.isAbsolute) {
                path.canonicalPath
            } else {
                File(projectRoot, pathString).canonicalPath
            }
            absPath
        } catch (e: Exception) {
            logger?.warn("Failed to convert relative path to absolute: $pathString, using as-is")
            pathString
        }
    }

    /**
     * Convert a set of absolute paths to relative paths
     */
    fun toRelativePaths(absolutePaths: Set<String>, projectRoot: File, logger: Logger? = null): Set<String> {
        return absolutePaths.map { toRelativePath(it, projectRoot, logger) }.toSet()
    }

    /**
     * Convert a set of paths (potentially relative) to absolute paths
     */
    fun toAbsolutePaths(paths: Set<String>, projectRoot: File, logger: Logger? = null): Set<String> {
        return paths.map { toAbsolutePath(it, projectRoot, logger) }.toSet()
    }
}
