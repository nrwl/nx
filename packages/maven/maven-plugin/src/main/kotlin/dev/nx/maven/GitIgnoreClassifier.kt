package dev.nx.maven

import org.eclipse.jgit.ignore.FastIgnoreRule
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Determines if files match gitignore patterns
 * Provides heuristic for parameter classification: ignored files are likely outputs, tracked files are likely inputs
 * Supports nested .gitignore files throughout the directory tree
 */
class GitIgnoreClassifier(
  private val workspaceRoot: File
) {
    private val log = LoggerFactory.getLogger(GitIgnoreClassifier::class.java)

    // Map from directory path to list of ignore rules for that directory
    private val ignoreRulesByDirectory: MutableMap<String, MutableList<FastIgnoreRule>> = mutableMapOf()

  init {
    // Load root gitignore
    loadIgnoreRulesForDirectory(workspaceRoot)
  }

  private fun loadIgnoreRulesForDirectory(directory: File) {
    val dirPath = directory.absolutePath
    if (ignoreRulesByDirectory.containsKey(dirPath)) {
      return // Already loaded
    }

    val rules = mutableListOf<FastIgnoreRule>()
    try {
      val gitIgnoreFile = File(directory, ".gitignore")
      if (gitIgnoreFile.exists()) {
        gitIgnoreFile.readLines().forEach { line ->
          val trimmed = line.trim()
          if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
            try {
              val rule = FastIgnoreRule(trimmed)
              rules.add(rule)
            } catch (e: Exception) {
              // Skip invalid rules silently
            }
          }
        }
      }
    } catch (e: Exception) {
      // If we can't load gitignore rules, continue without them
    }

    ignoreRulesByDirectory[dirPath] = rules
  }

  private fun isPartOfWorkspace(path: File): Boolean {
    // Use canonicalPath to resolve symlinks and normalize paths
    val workspaceRootPath = try {
      workspaceRoot.canonicalPath
    } catch (e: Exception) {
      workspaceRoot.absolutePath
    }

    val filePath = try {
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
   * Determines if a file path should be ignored according to gitignore rules
   * Works for both existing and non-existent paths by using pattern matching
   * Checks nested .gitignore files from the file's directory up to workspace root
   */
  fun isIgnored(path: File): Boolean {
    if (!isPartOfWorkspace(path)) {
      return false
    }

    // Get all directories from file's parent up to workspace root
    val directoriesToCheck = mutableListOf<File>()
    var currentDir = if (path.isDirectory) path else path.parentFile

    while (currentDir != null && isPartOfWorkspace(currentDir)) {
      directoriesToCheck.add(currentDir)
      if (currentDir.absolutePath == workspaceRoot.absolutePath) {
        break
      }
      currentDir = currentDir.parentFile
    }

    // Check from innermost directory to workspace root
    // This allows nested .gitignore files to override parent rules
    var isIgnored = false

    for (directory in directoriesToCheck.reversed()) {
      // Load rules for this directory if not already loaded
      loadIgnoreRulesForDirectory(directory)

      val rules = ignoreRulesByDirectory[directory.absolutePath] ?: continue
      if (rules.isEmpty()) {
        continue
      }

      // Get path relative to this directory's .gitignore
      val relativePath = try {
        path.relativeTo(directory).path
      } catch (e: IllegalArgumentException) {
        continue
      }

      // Check path against rules in this directory's .gitignore
      try {
        for (rule in rules) {
          val isDirectory = path.isDirectory || relativePath.endsWith("/")
          if (rule.isMatch(relativePath, isDirectory)) {
            // FastIgnoreRule.getResult() returns true if should be ignored
            isIgnored = rule.result
          }
        }
      } catch (e: Exception) {
        // Continue checking other directories
      }
    }

    return isIgnored
  }
}
