package dev.nx.maven.utils

import org.apache.maven.execution.MavenSession
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory

/**
 * Resolves Maven expressions and parameter values
 */
class MavenExpressionResolver(
    private val session: MavenSession
) {
    private val log: Logger = LoggerFactory.getLogger(MavenExpressionResolver::class.java)

    /**
     * Resolves a mojo parameter value by trying expression, default value, and known mappings
     */
    fun resolveParameterValue(name: String, defaultValue: String?, expression: String?, project: MavenProject): String? {
        // Try expression first
        expression?.let { expr ->
            val resolved = resolveExpression(expr, project)
            if (resolved != expr) {
                // Filter out values that look like version numbers, not paths
                if (isValidPath(resolved)) {
                    return resolved
                } else {
                    return null
                }
            }
        }

        // Try default value
        defaultValue?.let { default ->
            val resolved = resolveExpression(default, project)
            if (isValidPath(resolved)) {
                return resolved
            } else {
                return null
            }
        }

        // Try known parameter mappings based on what Maven actually provides
        val result = when (name) {
            // These map directly to Maven project model
            "compileSourceRoots" -> project.compileSourceRoots.firstOrNull()
            "testCompileSourceRoots" -> project.testCompileSourceRoots.firstOrNull()
            "sourceDirectory" -> project.build.sourceDirectory
            "testSourceDirectory" -> project.build.testSourceDirectory
            "outputDirectory" -> project.build.outputDirectory
            "testOutputDirectory" -> project.build.testOutputDirectory
            "buildDirectory" -> project.build.directory
            "classesDirectory" -> project.build.outputDirectory
            "testClassesDirectory" -> project.build.testOutputDirectory
            "basedir" -> project.basedir?.absolutePath

            // Resources from project model
            "resources" -> project.build.resources?.firstOrNull()?.directory
            "testResources" -> project.build.testResources?.firstOrNull()?.directory

            // Classpath elements
            "classpathElements", "compileClasspathElements" -> {
                // Return classpath as colon-separated string of JAR paths
                project.compileClasspathElements?.joinToString(System.getProperty("path.separator"))
            }
            "testClasspathElements" -> {
                project.testClasspathElements?.joinToString(System.getProperty("path.separator"))
            }

            // Common plugin-specific paths (these are typically configured in pom.xml)
            "reportsDirectory" -> "${project.build.directory}/surefire-reports"
            "warSourceDirectory" -> "${project.basedir}/src/main/webapp"

            else -> null
        }

        return result
    }

    /**
     * Checks if a resolved value looks like a valid file path rather than a version number or other non-path value
     */
    private fun isValidPath(value: String?): Boolean {
        if (value.isNullOrBlank()) return false

        // Filter out values that look like version numbers (e.g., "1.8", "11", "17")
        // Use simple string matching instead of regex to avoid StackOverflowError
        if (isVersionNumber(value)) {
            return false
        }

        // Filter out other common non-path values
        if (value in setOf("true", "false", "UTF-8", "jar", "war", "ear", "pom", "test-jar")) {
            return false
        }

        // Must contain at least one path separator or be an absolute path
        return value.contains("/") || value.contains("\\") || value.startsWith(".") || java.io.File(value).isAbsolute
    }

    /**
     * Resolves Maven expressions in a string
     */
    fun resolveExpression(expression: String, project: MavenProject): String {
        if (!expression.contains("\${")) {
            return expression
        }

        var resolved = expression

        // Replace common project expressions
        resolved = resolved.replace("\${project.basedir}", project.basedir?.absolutePath ?: "")
        resolved = resolved.replace("\${basedir}", project.basedir?.absolutePath ?: "")
        resolved = resolved.replace("\${project.build.directory}", project.build?.directory ?: "target")
        resolved = resolved.replace("\${project.build.outputDirectory}", project.build?.outputDirectory ?: "target/classes")
        resolved = resolved.replace("\${project.build.testOutputDirectory}", project.build?.testOutputDirectory ?: "target/test-classes")
        resolved = resolved.replace("\${project.build.finalName}", project.build?.finalName ?: "${project.artifactId}-${project.version}")
        resolved = resolved.replace("\${project.artifactId}", project.artifactId ?: "")
        resolved = resolved.replace("\${project.groupId}", project.groupId ?: "")
        resolved = resolved.replace("\${project.version}", project.version ?: "")
        resolved = resolved.replace("\${project.name}", project.name ?: "")

        // Replace session expressions
        resolved = resolved.replace("\${session.executionRootDirectory}", session.executionRootDirectory ?: "")

        // Replace system properties
        System.getProperties().forEach { key, value ->
            resolved = resolved.replace("\${$key}", value.toString())
        }

        // Replace user properties from session
        session.userProperties?.forEach { key, value ->
            resolved = resolved.replace("\${$key}", value.toString())
        }

        // Replace system properties from session
        session.systemProperties?.forEach { key, value ->
            resolved = resolved.replace("\${$key}", value.toString())
        }

        return resolved
    }

    /**
     * Check if a string looks like a version number without using regex
     */
    private fun isVersionNumber(value: String): Boolean {
        if (value.isEmpty()) return false

        // Simple check: starts with digit and contains only digits and dots
        if (!value[0].isDigit()) return false

        for (char in value) {
            if (!char.isDigit() && char != '.') {
                return false
            }
        }

        // Avoid multiple consecutive dots or ending with dot
        if (value.contains("..") || value.endsWith(".")) {
            return false
        }

        return true
    }
}
