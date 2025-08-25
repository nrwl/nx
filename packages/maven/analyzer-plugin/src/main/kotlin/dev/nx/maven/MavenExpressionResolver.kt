package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Resolves Maven expressions and parameter values
 */
class MavenExpressionResolver(
    private val session: MavenSession,
    private val log: Log
) {
    
    /**
     * Resolves a mojo parameter value by trying expression, default value, and known mappings
     */
    fun resolveParameterValue(name: String, defaultValue: String?, expression: String?, project: MavenProject): String? {
        // Try expression first
        expression?.let { expr ->
            val resolved = resolveExpression(expr, project)
            if (resolved != expr) return resolved
        }
        
        // Try default value
        defaultValue?.let { default ->
            return resolveExpression(default, project)
        }
        
        // Try known parameter mappings
        return when (name) {
            "sourceDirectory" -> project.compileSourceRoots.firstOrNull()
            "testSourceDirectory" -> project.testCompileSourceRoots.firstOrNull()
            "outputDirectory" -> project.build.outputDirectory
            "testOutputDirectory" -> project.build.testOutputDirectory
            "buildDirectory" -> project.build.directory
            "classpathElements", "compileClasspathElements" -> {
                // Return classpath as colon-separated string of JAR paths
                project.compileClasspathElements?.joinToString(System.getProperty("path.separator"))
            }
            "testClasspathElements" -> {
                project.testClasspathElements?.joinToString(System.getProperty("path.separator"))
            }
            else -> null
        }
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
}