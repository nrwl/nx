package dev.nx.maven

import org.eclipse.jgit.api.Git
import org.eclipse.jgit.lib.Repository
import org.eclipse.jgit.storage.file.FileRepositoryBuilder
import org.slf4j.LoggerFactory
import java.io.File
import java.io.IOException

/**
 * Uses JGit to determine if files match gitignore patterns
 * Provides heuristic for parameter classification: ignored files are likely outputs, tracked files are likely inputs
 */
class GitIgnoreClassifier(
    private val projectRoot: File
) {
    private val log = LoggerFactory.getLogger(GitIgnoreClassifier::class.java)
    
    private var git: Git? = null
    private var repository: Repository? = null
    private var isGitRepo: Boolean = false
    
    init {
        initializeGitRepository()
    }
    
    private fun initializeGitRepository() {
        try {
            val gitDir = findGitDirectory(projectRoot)
            if (gitDir != null) {
                repository = FileRepositoryBuilder()
                    .setGitDir(gitDir)
                    .readEnvironment()
                    .build()
                git = Git(repository)
                isGitRepo = true
                log.debug("Initialized Git repository from: ${gitDir.path}")
            } else {
                log.debug("No Git repository found in project: ${projectRoot.path}")
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
    
    /**
     * Determines if a file path should be ignored according to gitignore rules
     * Returns null if not a git repository or path cannot be resolved
     */
    fun isIgnored(path: String): Boolean? {
        if (!isGitRepo || git == null) {
            return null
        }
        
        return try {
            val file = File(path)
            val relativePath = if (file.isAbsolute) {
                try {
                    file.relativeTo(projectRoot).path.replace('\\', '/')
                } catch (e: IllegalArgumentException) {
                    // Path is outside project root
                    return null
                }
            } else {
                path.replace('\\', '/')
            }
            
            // Use JGit's status to check if file is ignored
            val status = git!!.status()
                .addPath(relativePath)
                .call()
            
            val isIgnored = status.ignoredNotInIndex.contains(relativePath)
            log.debug("Path '$relativePath' ignored status: $isIgnored")
            isIgnored
            
        } catch (e: Exception) {
            log.debug("Error checking ignore status for path '$path': ${e.message}")
            null
        }
    }
    
    /**
     * Provides a heuristic parameter role based on gitignore status
     * - Files that are gitignored are likely OUTPUTS (build artifacts, generated files)
     * - Files that are NOT gitignored are likely INPUTS (source code, configuration)
     */
    fun suggestParameterRole(path: String): ParameterRole? {
        val ignoredStatus = isIgnored(path)
        
        return when (ignoredStatus) {
            true -> {
                log.debug("Path '$path' is gitignored -> suggesting OUTPUT")
                ParameterRole.OUTPUT
            }
            false -> {
                log.debug("Path '$path' is NOT gitignored -> suggesting INPUT")
                ParameterRole.INPUT
            }
            null -> {
                // No git repository or couldn't determine status
                log.debug("Path '$path' gitignore status unknown")
                null
            }
        }
    }
    
    /**
     * Fast heuristic check without using Git API
     * Uses common Maven patterns for quick classification
     */
    fun fastHeuristic(path: String): ParameterRole? {
        val file = File(path)
        val relativePath = try {
            if (file.isAbsolute) {
                file.relativeTo(projectRoot).path.replace('\\', '/')
            } else {
                path.replace('\\', '/')
            }
        } catch (e: IllegalArgumentException) {
            return null
        }
        
        return when {
            // Common output patterns (typically gitignored)
            relativePath.startsWith("target/") -> ParameterRole.OUTPUT
            relativePath.contains("/target/") -> ParameterRole.OUTPUT
            relativePath.startsWith("build/") -> ParameterRole.OUTPUT
            relativePath.endsWith(".class") -> ParameterRole.OUTPUT
            relativePath.endsWith(".jar") -> ParameterRole.OUTPUT
            relativePath.endsWith(".war") -> ParameterRole.OUTPUT
            relativePath.endsWith(".ear") -> ParameterRole.OUTPUT
            
            // Common input patterns (typically NOT gitignored)
            relativePath.startsWith("src/main/") -> ParameterRole.INPUT
            relativePath.startsWith("src/test/") -> ParameterRole.INPUT
            relativePath == "pom.xml" -> ParameterRole.INPUT
            relativePath.endsWith(".java") -> ParameterRole.INPUT
            relativePath.endsWith(".kt") -> ParameterRole.INPUT
            relativePath.endsWith(".xml") && !relativePath.startsWith("target/") -> ParameterRole.INPUT
            relativePath.endsWith(".properties") && !relativePath.startsWith("target/") -> ParameterRole.INPUT
            
            else -> null
        }
    }
    
    /**
     * Combines fast heuristic with Git status for best accuracy
     */
    fun classifyPath(path: String): ParameterRole? {
        // Try fast heuristic first
        val heuristicRole = fastHeuristic(path)
        if (heuristicRole != null) {
            log.debug("Path '$path' classified by fast heuristic: $heuristicRole")
            return heuristicRole
        }
        
        // Fall back to Git status if available
        val gitRole = suggestParameterRole(path)
        if (gitRole != null) {
            log.debug("Path '$path' classified by Git status: $gitRole")
            return gitRole
        }
        
        log.debug("Path '$path' could not be classified")
        return null
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