package dev.nx.maven.utils

import java.io.File
import java.io.IOException

// Windows can't canonicalize a path with glob characters in it.
internal fun File.canonicalOrAbsolute(): File =
  try { canonicalFile } catch (e: IOException) { absoluteFile.normalize() }

internal fun File.isUnder(dir: File): Boolean {
  val dirPath = dir.canonicalOrAbsolute().path
  return canonicalOrAbsolute().path.let { it == dirPath || it.startsWith(dirPath + File.separator) }
}

/**
 * Handles path resolution, Maven command detection, and input/output path formatting for Nx
 */
class PathFormatter {

  fun formatInputPath(path: File, projectRoot: File): String {
    return toProjectPath(path, projectRoot)
  }

  fun formatOutputPath(path: File, projectRoot: File): String {
    return toProjectPath(path, projectRoot)
  }

  fun toProjectPath(path: File, projectRoot: File): String {
    val relativePath = path.relativeToOrSelf(projectRoot)

    return "{projectRoot}/${relativePath.invariantSeparatorsPath}"
  }

  fun toWorkspacePath(path: File, workspaceRoot: File): String {
    val relativePath = path.canonicalOrAbsolute().relativeTo(workspaceRoot.canonicalOrAbsolute())

    return "{workspaceRoot}/${relativePath.invariantSeparatorsPath}"
  }

  fun relativePath(file: File, base: File): String = file.relativeTo(base).invariantSeparatorsPath.ifEmpty { "." }
}
