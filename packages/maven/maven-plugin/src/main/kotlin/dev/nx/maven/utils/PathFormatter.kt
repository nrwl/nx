package dev.nx.maven.utils

import java.io.File

/**
 * Handles path resolution, Maven command detection, and input/output path formatting for Nx
 */
class PathFormatter {

  fun formatInputPath(path: File, projectRoot: File): String {
    return toProjectPath(path, projectRoot)
  }

  fun toDependentTaskOutputs(path: File, projectRoot: File): DependentTaskOutputs {
    val relativePath = path.relativeTo(projectRoot)
    return DependentTaskOutputs(relativePath.invariantSeparatorsPath)
  }

  fun formatOutputPath(path: File, projectRoot: File): String {
    return toProjectPath(path, projectRoot)
  }

  fun toProjectPath(path: File, projectRoot: File): String {
    val relativePath = path.relativeToOrSelf(projectRoot)

    return "{projectRoot}/${relativePath.invariantSeparatorsPath}"
  }

  fun toWorkspacePath(path: File, workspaceRoot: File): String {
    val relativePath = path.canonicalFile.relativeTo(workspaceRoot.canonicalFile)

    return "{workspaceRoot}/${relativePath.invariantSeparatorsPath}"
  }

  /**
   * Nx addresses projects and files with `/` on every platform, but Kotlin's
   * relative-path APIs use the OS separator, so on Windows they yield
   * `backend\common`. Emitting that makes Nx fail to resolve the project.
   */
  fun normalizeRelativePath(path: String): String =
    path.replace('\\', '/').takeIf { it.isNotEmpty() } ?: "."
}

data class DependentTaskOutputs(val path: String, val transitive: Boolean = true)
