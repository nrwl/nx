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
        log.debug("Loading .gitignore from: {}", gitIgnoreFile.absolutePath)
        gitIgnoreFile.readLines().forEach { line ->
          val trimmed = line.trim()
          if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
            try {
              val rule = FastIgnoreRule(trimmed)
              rules.add(rule)
              log.debug("  Loaded rule: '{}'", trimmed)
            } catch (e: Exception) {
              log.debug("  Invalid rule skipped: '{}' - {}", trimmed, e.message)
            }
          }
        }
        log.debug("Loaded {} rules from {}", rules.size, gitIgnoreFile.absolutePath)
      } else {
        log.debug("No .gitignore found in: {}", dirPath)
      }
    } catch (e: Exception) {
      log.debug("Error loading gitignore from {}: {}", dirPath, e.message)
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
      log.debug("Path is not part of workspace: {} (workspace: {})", path.absolutePath, workspaceRoot.absolutePath)
      return false
    }

    // Get all directories from file's parent up to workspace root
    // For a path like "workspace/target", we need to check workspace/.gitignore
    // Start from the path's parent (or the path itself if it's a directory)
    val directoriesToCheck = mutableListOf<File>()
    var currentDir = path.parentFile

    // Always include at least the workspace root
    while (currentDir != null) {
      if (isPartOfWorkspace(currentDir) || currentDir.absolutePath == workspaceRoot.absolutePath) {
        directoriesToCheck.add(currentDir)
      }
      if (currentDir.absolutePath == workspaceRoot.absolutePath) {
        break
      }
      currentDir = currentDir.parentFile
    }

    // If we didn't get the workspace root (e.g., path is directly under workspace root),
    // make sure it's included
    if (directoriesToCheck.isEmpty() || directoriesToCheck.none { it.absolutePath == workspaceRoot.absolutePath }) {
      directoriesToCheck.add(workspaceRoot)
    }

    log.debug("Checking path: {} against directories: {}", path.absolutePath, directoriesToCheck.map { it.absolutePath })

    // Check from workspace root to innermost directory
    // This allows nested .gitignore files to override parent rules
    var isIgnored = false

    for (directory in directoriesToCheck.reversed()) {
      // Load rules for this directory if not already loaded
      loadIgnoreRulesForDirectory(directory)

      val rules = ignoreRulesByDirectory[directory.absolutePath] ?: continue
      if (rules.isEmpty()) {
        log.debug("No gitignore rules in: {}", directory.absolutePath)
        continue
      }

      // Get path relative to this directory's .gitignore
      // Use forward slashes as required by JGit's FastIgnoreRule
      val relativePath = try {
        path.relativeTo(directory).path.replace('\\', '/')
      } catch (e: IllegalArgumentException) {
        log.debug("Could not compute relative path from {} to {}", directory.absolutePath, path.absolutePath)
        continue
      }

      // Skip empty relative paths (path is the directory itself)
      if (relativePath.isEmpty()) {
        continue
      }

      log.debug("Checking relativePath '{}' against {} rules in {}", relativePath, rules.size, directory.absolutePath)

      // Check path against rules in this directory's .gitignore
      // We need to check both the full path AND each parent path segment
      // because a rule like "target/" should match "target/test-classes"
      try {
        // Check each path segment from root to leaf
        // e.g., for "target/test-classes", check "target" then "target/test-classes"
        val pathSegments = relativePath.split("/")
        var currentPath = ""

        for ((index, segment) in pathSegments.withIndex()) {
          currentPath = if (currentPath.isEmpty()) segment else "$currentPath/$segment"
          val isLastSegment = index == pathSegments.lastIndex
          // Directory check: it's a directory if it's not the last segment,
          // or if the original path is a directory, or if it ends with /
          // For non-existent paths, assume directories unless it has a file extension
          val isDir = !isLastSegment || path.isDirectory || relativePath.endsWith("/") ||
            (!path.exists() && !segment.contains("."))

          for (rule in rules) {
            val matched = rule.isMatch(currentPath, isDir)
            if (matched) {
              log.debug("Rule matched: pattern for '{}' (isDir={}) -> result={}", currentPath, isDir, rule.result)
              // FastIgnoreRule.getResult() returns true if should be ignored
              isIgnored = rule.result
            }
          }

          // If a parent is ignored, all children are ignored (unless negated later)
          // Continue checking to allow negation rules to override
        }
      } catch (e: Exception) {
        log.debug("Exception while checking rules: {}", e.message)
        // Continue checking other directories
      }
    }

    if (!isIgnored) {
      log.debug("Path NOT ignored: {} (no matching rules found)", path.absolutePath)
    } else {
      log.debug("Path IS ignored: {}", path.absolutePath)
    }

    return isIgnored
  }
}
