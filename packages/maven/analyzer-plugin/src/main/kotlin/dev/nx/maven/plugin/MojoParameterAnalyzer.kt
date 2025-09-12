package dev.nx.maven.plugin

import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject
import dev.nx.maven.PathResolver
import dev.nx.maven.MavenExpressionResolver

/**
 * Analyzes Maven mojo parameters to determine inputs, outputs, and cacheability
 */
class MojoParameterAnalyzer(
    private val log: Log,
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver
) {

    /**
     * Analyzes a mojo's parameters to find inputs and outputs
     */
    fun analyzeMojo(mojo: MojoDescriptor, project: MavenProject, inputs: MutableSet<String>, outputs: MutableSet<String>) {

        // Analyze mojo parameters to find inputs and outputs
        for (param in mojo.parameters ?: emptyList()) {
            analyzeParameter(param, project, inputs, outputs)
        }
    }

    /**
     * Analyzes a single mojo parameter to determine if it's an input or output
     */
    private fun analyzeParameter(param: Parameter, project: MavenProject, inputs: MutableSet<String>, outputs: MutableSet<String>) {
        val name = param.name ?: return
        val type = param.type ?: return
        val defaultValue = param.defaultValue
        val expression = param.expression


        log.info("Analyzing parameter: name=$name, type=$type, defaultValue=$defaultValue, expression=$expression")

        when {
            isInputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    log.debug("Adding input path: $path (from parameter $name)")
                    pathResolver.addInputPath(path, inputs)
                } else {
                    log.debug("Parameter $name resolved to null path")
                }
            }
            isOutputParameter(name, type, param) -> {
                val path = expressionResolver.resolveParameterValue(name, defaultValue, expression, project)
                if (path != null) {
                    log.debug("Adding output path: $path (from parameter $name)")
                    pathResolver.addOutputPath(path, outputs)
                } else {
                    log.debug("Parameter $name resolved to null path")
                }
            }
            else -> {
                log.debug("Parameter $name is neither input nor output")
            }
        }
    }

    /**
     * Determines if a parameter represents an input (source files, resources, dependencies, etc.)
     */
    private fun isInputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check parameter name patterns for inputs
        val inputNamePatterns = listOf(
            // Source directories
            "sourceDirectory", "sourceDirs", "sourceRoots", "compileSourceRoots",
            "testSourceDirectory", "testSourceRoots", "testCompileSourceRoots",

            // Resource directories
            "resourceDirectory", "resources", "testResources", "webappDirectory",

            // Classpath elements
            "classpathElements", "compileClasspathElements", "testClasspathElements",
            "runtimeClasspathElements", "systemPath", "compileClasspath", "runtimeClasspath",

            // Input files
            "inputFile", "inputFiles", "sourceFile", "sourceFiles", "includes", "include",
            "configLocation", "configFile", "rulesFile", "suppressionsFile",

            // Maven coordinates for dependencies
            "groupId", "artifactId", "classifier", "scope",

            // Web application sources
            "warSourceDirectory", "webXml", "containerConfigXML",

            // Other specific input patterns (removed overly broad basedir/workingDirectory/projectDirectory)
            "generatedSourcesDirectory", "generatedTestSourcesDirectory"
        )

        // Check if parameter name matches input patterns
        val nameMatch = inputNamePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }

        // Check parameter type for input types
        val inputTypePatterns = listOf(
            "java.io.File", "java.util.List", "java.util.Set",
            "java.lang.String", "java.nio.file.Path"
        )

        val typeMatch = inputTypePatterns.any { pattern ->
            type.contains(pattern, ignoreCase = true)
        }

        // Additional checks based on parameter characteristics
        val isReadable = param.description?.contains("read", ignoreCase = true) == true ||
                        param.description?.contains("source", ignoreCase = true) == true ||
                        param.description?.contains("input", ignoreCase = true) == true

        // Parameters that are clearly not inputs
        val excludePatterns = listOf(
            "outputDirectory", "targetDirectory", "buildDirectory", "destinationFile",
            "outputFile", "target", "destination", "finalName"
        )

        val isExcluded = excludePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }

        val result = (nameMatch || isReadable) && typeMatch && !isExcluded


        return result
    }

    /**
     * Determines if a parameter represents an output (target directories, generated files, etc.)
     */
    private fun isOutputParameter(name: String, type: String, param: Parameter): Boolean {
        // Check parameter name patterns for outputs
        val outputNamePatterns = listOf(
            // Output directories
            "outputDirectory", "targetDirectory", "buildDirectory", "destinationDir",
            "testOutputDirectory", "generatedSourcesDirectory",

            // Output files
            "outputFile", "destinationFile", "targetFile", "finalName",
            "jarName", "warName", "earName",

            // Report directories
            "reportOutputDirectory", "reportsDirectory", "outputFormat",

            // Generated content
            "generatedSources", "generatedResources", "generatedClasses",

            // Archive outputs
            "archiveFile", "archiveName", "packagedFile"
        )

        // Check if parameter name matches output patterns
        val nameMatch = outputNamePatterns.any { pattern ->
            name.contains(pattern, ignoreCase = true)
        }

        // Check parameter type for output types
        val outputTypePatterns = listOf(
            "java.io.File", "java.lang.String", "java.nio.file.Path"
        )

        val typeMatch = outputTypePatterns.any { pattern ->
            type.contains(pattern, ignoreCase = true)
        }

        // Additional checks based on parameter characteristics
        val isWritable = param.description?.contains("output", ignoreCase = true) == true ||
                        param.description?.contains("target", ignoreCase = true) == true ||
                        param.description?.contains("destination", ignoreCase = true) == true ||
                        param.description?.contains("generate", ignoreCase = true) == true

        val result = (nameMatch || isWritable) && typeMatch


        return result
    }

    /**
     * Determines if a mojo has side effects that would make it non-cacheable
     * Uses comprehensive analysis of mojo metadata, annotations, and parameters
     */
    fun isSideEffectMojo(mojo: MojoDescriptor): Boolean {
        // Check Maven @Mojo annotation properties
        if (hasAnnotationBasedSideEffects(mojo)) {
            return true
        }

        // Check parameter-level side effects
        if (hasParameterBasedSideEffects(mojo)) {
            return true
        }

        // Fallback to goal and plugin pattern matching
        return hasPatternBasedSideEffects(mojo)
    }

    /**
     * Checks for side effects based on Maven @Mojo annotation properties
     */
    private fun hasAnnotationBasedSideEffects(mojo: MojoDescriptor): Boolean {
        // Aggregator mojos typically have cross-project side effects
        if (mojo.isAggregator) {
            return true
        }

        // Non-thread-safe mojos in deployment/installation phases likely have side effects
        if (!mojo.isThreadSafe && mojo.phase in listOf("install", "deploy")) {
            return true
        }

        return false
    }

    /**
     * Detects side effect characteristics using Maven API metadata
     */
    private fun hasSideEffectCharacteristics(mojo: MojoDescriptor): Boolean {
        val goal = mojo.goal
        val pluginDescriptor = mojo.pluginDescriptor

        // Check if plugin modifies external state based on dependency resolution requirements
        val dependencyResolution = mojo.dependencyResolutionRequired
        if (dependencyResolution == "runtime" && goal.contains("repackage", ignoreCase = true)) {
            return true // Modifies artifacts
        }

        // Check for parameters that indicate external interactions
        val parameters = mojo.parameters ?: return false
        val hasNetworkParams = parameters.any { param ->
            val name = param.name.lowercase()
            val type = param.type.lowercase()
            val description = param.description?.lowercase() ?: ""

            // Network/deployment related parameters
            name.contains("url") || name.contains("repository") || name.contains("server") ||
            name.contains("host") || name.contains("port") || name.contains("endpoint") ||
            description.contains("deploy") || description.contains("publish") ||
            description.contains("upload") || description.contains("remote")
        }

        if (hasNetworkParams) {
            return true
        }

        // Check for file system modification beyond target directory
        val hasFileSystemSideEffects = parameters.any { param ->
            val name = param.name.lowercase()
            val description = param.description?.lowercase() ?: ""

            (name.contains("install") && param.type == "java.io.File") ||
            description.contains("install") || description.contains("deploy") ||
            description.contains("modify") || description.contains("update")
        }

        return hasFileSystemSideEffects
    }

    /**
     * Checks for side effects based on mojo parameters
     */
    private fun hasParameterBasedSideEffects(mojo: MojoDescriptor): Boolean {
        val parameters = mojo.parameters ?: return false

        // For now, we'll skip complex parameter analysis and rely on goal/plugin patterns
        return false
    }

    /**
     * Fallback pattern-based side effect detection
     */
    private fun hasPatternBasedSideEffects(mojo: MojoDescriptor): Boolean {
        val goal = mojo.goal
        val artifactId = mojo.pluginDescriptor.artifactId

        log.debug("Checking pattern-based side effects for ${artifactId}:${goal}")

        // Known side-effect goals
        val sideEffectGoals = setOf(
            // Deployment and installation
            "deploy", "install", "release",

            // External system interactions
            "exec", "run", "start", "stop",

            // Network operations
            "upload", "download", "push", "pull",

            // Database operations
            "migrate", "create", "drop", "update"
        )

        if (sideEffectGoals.contains(goal)) {
            log.debug("${artifactId}:${goal} flagged - goal '${goal}' is in side-effect goals")
            return true
        }

        // Use Maven API characteristics to detect side effect plugins
        if (hasSideEffectCharacteristics(mojo)) {
            log.debug("${artifactId}:${goal} flagged - plugin has side-effect characteristics")
            return true
        }

        if (goal.contains("deploy", ignoreCase = true)) {
            log.debug("${artifactId}:${goal} flagged - goal contains 'deploy'")
            return true
        }

        if (goal.contains("install", ignoreCase = true)) {
            log.debug("${artifactId}:${goal} flagged - goal contains 'install'")
            return true
        }

        if (goal.contains("release", ignoreCase = true)) {
            log.debug("${artifactId}:${goal} flagged - goal contains 'release'")
            return true
        }

        log.debug("${artifactId}:${goal} passed all side-effect checks")
        return false
    }
}
