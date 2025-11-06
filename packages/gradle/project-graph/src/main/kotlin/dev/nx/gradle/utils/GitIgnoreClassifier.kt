package dev.nx.gradle.utils

import java.io.File
import org.eclipse.jgit.ignore.FastIgnoreRule

/**
 * Determines if files match gitignore patterns Provides heuristic for parameter classification:
 * ignored files are likely outputs, tracked files are likely inputs
 */
class GitIgnoreClassifier(private val workspaceRoot: File) {
  private val ignoreRules: MutableList<FastIgnoreRule> = mutableListOf()

  init {
    loadIgnoreRules()
  }

  private fun loadIgnoreRules() {
    try {
      val gitIgnoreFile = File(workspaceRoot, ".gitignore")
      if (gitIgnoreFile.exists()) {
        gitIgnoreFile.readLines().forEach { line ->
          val trimmed = line.trim()
          if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
            try {
              val rule = FastIgnoreRule(trimmed)
              ignoreRules.add(rule)
            } catch (e: Exception) {
              // Skip invalid rules silently
            }
          }
        }
      }
    } catch (e: Exception) {
      // If we can't load gitignore rules, continue without them
    }
  }

  private fun isPartOfWorkspace(path: File): Boolean {
    // Use canonicalPath to resolve symlinks and normalize paths
    val workspaceRootPath =
        try {
          workspaceRoot.canonicalPath
        } catch (e: Exception) {
          workspaceRoot.absolutePath
        }

    val filePath =
        try {
          path.canonicalPath
        } catch (e: Exception) {
          path.absolutePath
        }

    // Ensure the file path starts with the workspace root and is followed by a separator
    // or is exactly the workspace root (which we exclude)
    if (filePath == workspaceRootPath) {
      return false
    }

    return filePath.startsWith(workspaceRootPath + File.separator)
  }

  /**
   * Determines if a file path should be ignored according to gitignore rules Works for both
   * existing and non-existent paths by using pattern matching
   */
  fun isIgnored(path: File): Boolean {
    if (ignoreRules.isEmpty()) {
      return false
    }

    if (!isPartOfWorkspace(path)) {
      return false
    }

    val relativePath =
        try {
          path.relativeTo(workspaceRoot).path
        } catch (e: IllegalArgumentException) {
          return false
        }

    return try {
      // Check path against all ignore rules
      var isIgnored = false

      for (rule in ignoreRules) {
        val isDirectory = path.isDirectory || relativePath.endsWith("/")
        if (rule.isMatch(relativePath, isDirectory)) {
          // FastIgnoreRule.getResult() returns true if should be ignored
          isIgnored = rule.result
        }
      }

      isIgnored
    } catch (e: Exception) {
      false
    }
  }
}
