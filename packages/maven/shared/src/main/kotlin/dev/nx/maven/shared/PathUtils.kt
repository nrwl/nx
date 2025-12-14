package dev.nx.maven.shared

import org.slf4j.Logger
import java.io.File
import java.nio.file.Paths

/**
 * Utility object for converting between absolute and relative paths
 */
object PathUtils {

    /**
     * Convert an absolute path to a relative path from the project root
     */
    fun toRelativePath(absolutePath: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val absPath = File(absolutePath).canonicalPath
            val rootPath = projectRoot.canonicalPath
            Paths.get(rootPath).relativize(Paths.get(absPath)).toString()
        } catch (_: Exception) {
            logger?.warn("Failed to convert absolute path to relative: $absolutePath, using absolute path")
            absolutePath
        }
    }

    /**
     * Convert a relative path to an absolute path based on the project root
     */
    fun toAbsolutePath(pathString: String, projectRoot: File, logger: Logger? = null): String {
        return try {
            val path = File(pathString)
            if (path.isAbsolute) {
                path.canonicalPath
            } else {
                File(projectRoot, pathString).canonicalPath
            }
        } catch (_: Exception) {
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
