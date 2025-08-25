package dev.nx.maven

import com.fasterxml.jackson.databind.node.ArrayNode
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject

/**
 * Analyzes plugins that are already loaded/resolved by Maven
 * instead of trying to reload plugin descriptors
 */
class PreloadedPluginAnalyzer(
    private val log: Log,
    private val session: MavenSession,
    private val pathResolver: PathResolver
) {
    
    /**
     * Analyzes a phase using Maven's already-loaded plugin information
     */
    fun analyzePhaseInputsOutputs(phase: String, project: MavenProject, inputs: ArrayNode, outputs: ArrayNode): Boolean {
        log.debug("Analyzing phase '$phase' using preloaded Maven plugin data")
        
        try {
            // Use project's compile/test classpath elements directly - Maven has already resolved these!
            when (phase) {
                "compile" -> {
                    addCompileInputs(project, inputs)
                    addCompileOutputs(project, outputs)
                    return true
                }
                "test-compile" -> {
                    addTestCompileInputs(project, inputs)  
                    addTestCompileOutputs(project, outputs)
                    return true
                }
                "test" -> {
                    addTestInputs(project, inputs)
                    addTestOutputs(project, outputs)
                    return true
                }
                "package" -> {
                    addPackageInputs(project, inputs)
                    addPackageOutputs(project, outputs)
                    return true
                }
            }
            
        } catch (e: Exception) {
            log.debug("Failed to analyze phase using preloaded data: ${e.message}")
        }
        
        return false
    }
    
    private fun addCompileInputs(project: MavenProject, inputs: ArrayNode) {
        // Source directories
        project.compileSourceRoots?.forEach { sourceRoot ->
            pathResolver.addInputPath(sourceRoot, inputs)
        }
        
        // Resources
        project.resources?.forEach { resource ->
            pathResolver.addInputPath(resource.directory, inputs)
        }
        
        // Dependencies - Maven has already resolved these!
        // Exclude the project's own output directories to avoid circular dependencies
        val projectOutputDir = project.build?.outputDirectory
        val projectTestOutputDir = project.build?.testOutputDirectory
        
        log.debug("Total project.compileClasspathElements: ${project.compileClasspathElements?.size ?: 0}")
        project.compileClasspathElements?.forEach { classpathElement ->
            log.debug("Processing classpath element: $classpathElement")
            
            // Skip the project's own output directories - they should be outputs, not inputs
            if (classpathElement == projectOutputDir || classpathElement == projectTestOutputDir) {
                log.debug("Skipping project's own output directory as input: $classpathElement")
            } else {
                pathResolver.addInputPath(classpathElement, inputs)
            }
        }
        
        // Also try project artifacts for debugging
        log.debug("Project compile artifacts: ${project.compileArtifacts?.size ?: 0}")
        project.compileArtifacts?.forEach { artifact ->
            log.debug("Compile artifact: ${artifact.groupId}:${artifact.artifactId}:${artifact.version} -> ${artifact.file}")
        }
        
        log.debug("Added ${project.compileClasspathElements?.size ?: 0} compile classpath elements")
    }
    
    private fun addCompileOutputs(project: MavenProject, outputs: ArrayNode) {
        project.build?.outputDirectory?.let { outputDir ->
            pathResolver.addOutputPath(outputDir, outputs)
        }
        
        // Generated sources directory
        val generatedSources = "${project.build.directory}/generated-sources"
        pathResolver.addOutputPath(generatedSources, outputs)
    }
    
    private fun addTestCompileInputs(project: MavenProject, inputs: ArrayNode) {
        // Test source directories
        project.testCompileSourceRoots?.forEach { testSourceRoot ->
            pathResolver.addInputPath(testSourceRoot, inputs)
        }
        
        // Test resources
        project.testResources?.forEach { resource ->
            pathResolver.addInputPath(resource.directory, inputs)
        }
        
        // Main classes (test compilation depends on main compilation)
        project.build?.outputDirectory?.let { outputDir ->
            pathResolver.addInputPath(outputDir, inputs)
        }
        
        // Test dependencies - exclude project's own output directories
        val projectOutputDir = project.build?.outputDirectory
        val projectTestOutputDir = project.build?.testOutputDirectory
        
        project.testClasspathElements?.forEach { classpathElement ->
            // Skip the project's own output directories to avoid circular dependencies
            if (classpathElement == projectOutputDir || classpathElement == projectTestOutputDir) {
                log.debug("Skipping project's own output directory as test input: $classpathElement")
            } else {
                pathResolver.addInputPath(classpathElement, inputs)
            }
        }
        
        log.debug("Added ${project.testClasspathElements?.size ?: 0} test classpath elements")
    }
    
    private fun addTestCompileOutputs(project: MavenProject, outputs: ArrayNode) {
        project.build?.testOutputDirectory?.let { testOutputDir ->
            pathResolver.addOutputPath(testOutputDir, outputs)
        }
    }
    
    private fun addTestInputs(project: MavenProject, inputs: ArrayNode) {
        // Test classes
        project.build?.testOutputDirectory?.let { testOutputDir ->
            pathResolver.addInputPath(testOutputDir, inputs)
        }
        
        // Main classes 
        project.build?.outputDirectory?.let { outputDir ->
            pathResolver.addInputPath(outputDir, inputs)
        }
        
        // Test resources
        project.testResources?.forEach { resource ->
            pathResolver.addInputPath(resource.directory, inputs)
        }
        
        // Test runtime classpath - exclude project's own output directories
        val projectOutputDir = project.build?.outputDirectory
        val projectTestOutputDir = project.build?.testOutputDirectory
        
        project.testClasspathElements?.forEach { classpathElement ->
            // Skip the project's own output directories to avoid circular dependencies
            if (classpathElement == projectOutputDir || classpathElement == projectTestOutputDir) {
                log.debug("Skipping project's own output directory as test runtime input: $classpathElement")
            } else {
                pathResolver.addInputPath(classpathElement, inputs)
            }
        }
    }
    
    private fun addTestOutputs(project: MavenProject, outputs: ArrayNode) {
        // Surefire reports
        val surefireReports = "${project.build.directory}/surefire-reports"
        pathResolver.addOutputPath(surefireReports, outputs)
        
        // Test results
        val testResults = "${project.build.directory}/test-results"  
        pathResolver.addOutputPath(testResults, outputs)
    }
    
    private fun addPackageInputs(project: MavenProject, inputs: ArrayNode) {
        // Compiled classes
        project.build?.outputDirectory?.let { outputDir ->
            pathResolver.addInputPath(outputDir, inputs)
        }
        
        // Resources (already copied to output directory, but include source for completeness)
        project.resources?.forEach { resource ->
            pathResolver.addInputPath(resource.directory, inputs)
        }
    }
    
    private fun addPackageOutputs(project: MavenProject, outputs: ArrayNode) {
        // JAR file
        val finalName = project.build?.finalName ?: "${project.artifactId}-${project.version}"
        val jarFile = "${project.build.directory}/$finalName.jar"
        pathResolver.addOutputPath(jarFile, outputs)
        
        // Classes directory (sometimes referenced as output)
        project.build?.outputDirectory?.let { outputDir ->
            pathResolver.addOutputPath(outputDir, outputs)
        }
        
        // Maven archiver
        val mavenArchiver = "${project.build.directory}/maven-archiver"
        pathResolver.addOutputPath(mavenArchiver, outputs)
    }
}