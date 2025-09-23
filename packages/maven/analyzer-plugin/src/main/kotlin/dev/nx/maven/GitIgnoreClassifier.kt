package dev.nx.maven

import org.eclipse.jgit.api.Git
import org.eclipse.jgit.lib.Repository
import org.eclipse.jgit.ignore.FastIgnoreRule
import org.eclipse.jgit.storage.file.FileRepositoryBuilder
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Uses JGit to determine if files match gitignore patterns
 * Provides heuristic for parameter classification: ignored files are likely outputs, tracked files are likely inputs
 */
class GitIgnoreClassifier(
    private val workspaceRoot: File
) {
    private val log = LoggerFactory.getLogger(GitIgnoreClassifier::class.java)

    private var git: Git? = null
    private var repository: Repository? = null
    private var isGitRepo: Boolean = false
    private val ignoreRules: MutableList<FastIgnoreRule> = mutableListOf()

    init {
        initializeGitRepository()
        loadIgnoreRules()
    }

    private fun initializeGitRepository() {
        try {
            val gitDir = findGitDirectory(workspaceRoot)
            if (gitDir != null) {
                repository = FileRepositoryBuilder()
                    .setGitDir(gitDir)
                    .readEnvironment()
                    .build()
                git = Git(repository)
                isGitRepo = true
                log.debug("Initialized Git repository from: ${gitDir.path}")
            } else {
                log.debug("No Git repository found in project: ${workspaceRoot.path}")
                isGitRepo = false
            }
        } catch (e: Exception) {
            log.debug("Failed to initialize Git repository: ${e.message}")
            isGitRepo = false
        }
    }

    private fun findGitDirectory(startDir: File): File? {
        var current = startDir
        while (current.exists()) {
            val gitDir = File(current, ".git")
            if (gitDir.exists()) {
                return if (gitDir.isDirectory) gitDir else null
            }
            current = current.parentFile ?: break
        }
        return null
    }

    private fun loadIgnoreRules() {
        if (!isGitRepo) {
            return
        }

        try {
            val gitIgnoreFile = File(workspaceRoot, ".gitignore")
            if (gitIgnoreFile.exists()) {
                gitIgnoreFile.readLines().forEach { line ->
                    val trimmed = line.trim()
                    if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
                        try {
                            val rule = FastIgnoreRule(trimmed)
                            ignoreRules.add(rule)
                            log.debug("Loaded gitignore rule: $trimmed")
                        } catch (e: Exception) {
                            log.debug("Failed to parse gitignore rule '$trimmed': ${e.message}")
                        }
                    }
                }
                log.debug("Loaded ${ignoreRules.size} gitignore rules")
            } else {
                log.debug("No .gitignore file found at: ${gitIgnoreFile.path}")
            }
        } catch (e: Exception) {
            log.debug("Error loading gitignore rules: ${e.message}")
        }
    }

    /**
     * Determines if a file path should be ignored according to gitignore rules
     * Works for both existing and non-existent paths by using pattern matching
     */
    fun isIgnored(path: File): Boolean {
        if (!isGitRepo || ignoreRules.isEmpty()) {
            return false
        }

        val relativePath = try {
            path.relativeTo(workspaceRoot).path
        } catch (e: IllegalArgumentException) {
            // Path is outside workspace
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
                    log.debug("Path '$relativePath' matched rule, ignored: $isIgnored")
                }
            }

            log.debug("Path '$relativePath' final ignored status: $isIgnored")
            isIgnored

        } catch (e: Exception) {
            log.debug("Error checking ignore status for path '$path': ${e.message}")
            false
        }
    }

    fun close() {
        try {
            git?.close()
            repository?.close()
        } catch (e: Exception) {
            log.debug("Error closing Git repository: ${e.message}")
        }
    }
}
