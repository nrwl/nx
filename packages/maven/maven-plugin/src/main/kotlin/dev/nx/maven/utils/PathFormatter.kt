package dev.nx.maven.utils

import java.io.File

/**
 * Handles path resolution, Maven command detection, and input/output path formatting for Nx
 */
class PathFormatter {

  /**
   * `{projectRoot}/…` inside the module, `{workspaceRoot}/…` elsewhere in the
   * workspace, null outside it; `glob` is appended after the directory resolves.
   */
  fun formatInputPath(path: File, projectRoot: File, workspaceRoot: File, glob: String? = null): String? {
    // A relative path is a CacheConfig default such as `src/main/**/*`: it is
    // module-relative and carries its own glob tail. The tail is split off
    // before canonicalizing, which Windows refuses on `*` and `?`.
    val (directory, tail) =
      if (path.isAbsolute) path to null
      else {
        val segments = path.path.split('/', File.separatorChar)
        val globStart = segments.indexOfFirst { segment -> segment.any { it in "*?{[" } }
        val literal = if (globStart < 0) segments else segments.subList(0, globStart)
        val rest = if (globStart < 0) null else segments.subList(globStart, segments.size).joinToString("/")
        File(projectRoot, literal.joinToString(File.separator)) to rest
      }
    // A URL or a `*` from a -D property is not a path; skip it rather than abort the analysis.
    val canonicalPath = runCatching { directory.canonicalFile }.getOrNull() ?: return null
    val canonicalProjectRoot = projectRoot.canonicalFile
    val canonicalWorkspaceRoot = workspaceRoot.canonicalFile
    val (token, root) = when {
      canonicalPath.startsWith(canonicalProjectRoot) -> "{projectRoot}" to canonicalProjectRoot
      canonicalPath.startsWith(canonicalWorkspaceRoot) -> "{workspaceRoot}" to canonicalWorkspaceRoot
      else -> return null
    }
    val relative = canonicalPath.relativeTo(root).invariantSeparatorsPath
    val parts = listOfNotNull(relative.takeIf { it.isNotEmpty() }, tail, glob)
    // A declared input directory means its contents, which a fileset has to spell out; on a root
    // project every part is empty, and `{projectRoot}/` alone would name no files.
    return (parts.ifEmpty { listOf("**/*") }).joinToString("/", prefix = "$token/")
  }

  fun toDependentTaskOutputs(path: File, projectRoot: File): DependentTaskOutputs {
    val relativePath = path.relativeTo(projectRoot)
    return DependentTaskOutputs(relativePath.path)
  }

  fun formatOutputPath(path: File, projectRoot: File): String {
    return toProjectPath(path, projectRoot)
  }

  fun toProjectPath(path: File, projectRoot: File): String {
    val relativePath = path.relativeToOrSelf(projectRoot)

    return "{projectRoot}/$relativePath"
  }

  fun normalizeRelativePath(path: String): String = path.takeIf { it.isNotEmpty() } ?: "."
}

data class DependentTaskOutputs(val path: String, val transitive: Boolean = true)
