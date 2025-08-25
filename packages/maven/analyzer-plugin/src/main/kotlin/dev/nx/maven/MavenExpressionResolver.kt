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
            else -> null
        }
    }
    
    /**
     * Resolves Maven expressions in a string
     */
    fun resolveExpression(expression: String, project: MavenProject): String {
        var result = expression
        
        // Project build properties
        result = result.replace("\${project.build.directory}", project.build.directory ?: "\${project.basedir}/target")
        result = result.replace("\${project.build.outputDirectory}", project.build.outputDirectory ?: "\${project.build.directory}/classes")
        result = result.replace("\${project.build.testOutputDirectory}", project.build.testOutputDirectory ?: "\${project.build.directory}/test-classes")
        result = result.replace("\${project.build.sourceDirectory}", project.build.sourceDirectory ?: "\${project.basedir}/src/main/java")
        result = result.replace("\${project.build.testSourceDirectory}", project.build.testSourceDirectory ?: "\${project.basedir}/src/test/java")
        result = result.replace("\${project.build.finalName}", project.build.finalName ?: "\${project.artifactId}-\${project.version}")
        
        // Project properties
        result = result.replace("\${project.basedir}", project.basedir?.absolutePath ?: ".")
        result = result.replace("\${basedir}", project.basedir?.absolutePath ?: ".")
        result = result.replace("\${project.artifactId}", project.artifactId ?: "unknown")
        result = result.replace("\${project.groupId}", project.groupId ?: "unknown")
        result = result.replace("\${project.version}", project.version ?: "unknown")
        result = result.replace("\${project.name}", project.name ?: project.artifactId ?: "unknown")
        result = result.replace("\${project.packaging}", project.packaging ?: "jar")
        
        // Maven session properties
        result = result.replace("\${session.executionRootDirectory}", session.executionRootDirectory ?: ".")
        
        // Common Maven properties
        result = result.replace("\${maven.build.timestamp.format}", "yyyyMMdd-HHmm")
        
        // Recursively resolve nested expressions (max 5 levels to avoid infinite loops)
        var previousResult = result
        repeat(5) {
            result = result
                .replace("\${project.build.directory}", project.build.directory ?: "\${project.basedir}/target")
                .replace("\${project.basedir}", project.basedir?.absolutePath ?: ".")
                .replace("\${basedir}", project.basedir?.absolutePath ?: ".")
                
            if (result == previousResult) return@repeat // No more changes
            previousResult = result
        }
        
        return result
    }
}