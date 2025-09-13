package dev.nx.maven

import org.apache.maven.project.MavenProject
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.execution.MavenSession
import org.apache.maven.model.Plugin
import org.apache.maven.plugin.descriptor.Parameter
import org.slf4j.LoggerFactory
import dev.nx.maven.MavenExpressionResolver
import dev.nx.maven.PathResolver


/**
 * Handles path resolution, Maven command detection, and input/output path formatting for Nx
 */
class PhaseAnalyzer(
    private val pluginManager: MavenPluginManager,
    private val session: MavenSession,
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathResolver
) {
    val log = LoggerFactory.getLogger(PhaseAnalyzer::class.java)

    // Plugin knowledge base for common Maven plugins
    private val pluginKnowledge = mapOf(
        // Maven Compiler Plugin
        "maven-compiler-plugin:compile" to mapOf(
            "source" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Java source version"),
            "target" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Java target version"),
            "compileSourceRoots" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Source root directories"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Compiled classes output"),
            "classpathElements" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Compilation classpath")
        ),
        "maven-compiler-plugin:testCompile" to mapOf(
            "testSource" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Java test source version"),
            "testTarget" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Java test target version"),
            "testCompileSourceRoots" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test source directories"),
            "testOutputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Compiled test classes output"),
            "testClasspathElements" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test compilation classpath")
        ),

        // Maven Surefire Plugin (Testing)
        "maven-surefire-plugin:test" to mapOf(
            "testSourceDirectory" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test source directory"),
            "testClassesDirectory" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Compiled test classes"),
            "reportsDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Test reports output"),
            "testClasspathElements" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test runtime classpath"),
            "includes" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test include patterns"),
            "excludes" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test exclude patterns")
        ),

        // Maven Resources Plugin
        "maven-resources-plugin:resources" to mapOf(
            "resources" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Resource directories"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Resources output directory")
        ),
        "maven-resources-plugin:testResources" to mapOf(
            "testResources" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Test resource directories"),
            "testOutputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Test resources output")
        ),

        // Maven JAR Plugin
        "maven-jar-plugin:jar" to mapOf(
            "classesDirectory" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Compiled classes directory"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "JAR output directory"),
            "finalName" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "JAR file name")
        ),

        // Maven Clean Plugin
        "maven-clean-plugin:clean" to mapOf(
            "directory" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Directory to clean"),
            "filesets" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "File sets to clean")
        ),

        // Maven Install Plugin
        "maven-install-plugin:install" to mapOf(
            "file" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Artifact file to install"),
            "localRepository" to ParameterAnalysis(ParameterRole.OUTPUT, 1.0f, "Local repository location")
        ),

        // Maven Deploy Plugin
        "maven-deploy-plugin:deploy" to mapOf(
            "file" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Artifact file to deploy"),
            "repositoryId" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Target repository ID"),
            "url" to ParameterAnalysis(ParameterRole.INPUT, 1.0f, "Repository URL")
        )
    )

    /**
     * Checks the plugin knowledge base for known parameter roles
     */
    private fun checkKnowledgeBase(plugin: Plugin, goal: String, parameterName: String): ParameterAnalysis? {
        val pluginKey = "${plugin.artifactId}:$goal"
        return pluginKnowledge[pluginKey]?.get(parameterName)
    }

    fun analyze(project: MavenProject, phase: String): PhaseInformation {
        val plugins = project.build.plugins
        var isThreadSafe = true
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()

        val mojoDescriptors = plugins
            .flatMap { plugin ->
                plugin.executions
                    .filter { execution -> execution.phase == phase }
                    .flatMap { execution -> execution.goals }
                    .mapNotNull { goal -> getMojoDescriptor(plugin, goal, project) }
            }

        mojoDescriptors.forEach { descriptor ->
            if (!descriptor.isThreadSafe) {
                isThreadSafe = false
            }
            
            descriptor.parameters?.forEach { parameter ->
                analyzeParameterNew(parameter, project, inputs, outputs)
            }
        }

        return PhaseInformation(isThreadSafe, inputs, outputs)
    }

    /**
     * New parameter analysis using combined strategy with confidence scoring
     */
    private fun analyzeParameterNew(parameter: Parameter, project: MavenProject, inputs: MutableSet<String>, outputs: MutableSet<String>) {
        val name = parameter.name ?: return
        val type = parameter.type ?: return
        
        // Find the plugin and goal for this parameter (we need to track this context)
        val analysis = analyzeParameterRole(parameter, project)
        
        log.debug("Parameter analysis: $name -> ${analysis.role} (confidence: ${analysis.confidence}, reason: ${analysis.reason})")

        // Only process parameters with reasonable confidence (>= 0.4)
        if (analysis.confidence >= 0.4f) {
            val path = expressionResolver.resolveParameterValue(
                name, 
                parameter.defaultValue, 
                parameter.expression, 
                project
            )
            
            if (path != null) {
                when (analysis.role) {
                    ParameterRole.INPUT -> {
                        pathResolver.addInputPath(path, inputs)
                        log.debug("Added input path: $path (from parameter $name)")
                    }
                    ParameterRole.OUTPUT -> {
                        pathResolver.addOutputPath(path, outputs)
                        log.debug("Added output path: $path (from parameter $name)")
                    }
                    ParameterRole.BOTH -> {
                        pathResolver.addInputPath(path, inputs)
                        pathResolver.addOutputPath(path, outputs)
                        log.debug("Added input/output path: $path (from parameter $name)")
                    }
                    ParameterRole.UNKNOWN -> {
                        log.debug("Skipping unknown parameter: $name")
                    }
                }
            } else {
                log.debug("Parameter $name resolved to null path")
            }
        } else {
            log.debug("Skipping low-confidence parameter: $name (confidence: ${analysis.confidence})")
        }
    }

    /**
     * Comprehensive parameter role analysis using multiple strategies
     */
    private fun analyzeParameterRole(parameter: Parameter, project: MavenProject): ParameterAnalysis {
        // Strategy 1: Check plugin knowledge base (highest confidence)
        // Note: We don't have plugin/goal context here, so we'll skip this for now
        // In a real implementation, we'd pass this context through
        
        // Strategy 2: Analyze Maven expression (high confidence)
        val exprAnalysis = analyzeByExpression(parameter)
        if (exprAnalysis.role != ParameterRole.UNKNOWN) {
            return exprAnalysis
        }
        
        // Strategy 3: Use type and editability analysis (medium confidence)
        val typeAnalysis = analyzeByType(parameter)
        if (typeAnalysis != null) {
            return typeAnalysis
        }
        
        // Strategy 4: Fall back to description analysis (low confidence)
        val descAnalysis = analyzeByDescription(parameter)
        if (descAnalysis.role != ParameterRole.UNKNOWN) {
            return descAnalysis
        }
        
        return ParameterAnalysis(ParameterRole.UNKNOWN, 0.0f, "No analysis strategy succeeded")
    }

    private fun getMojoDescriptor(plugin: Plugin, goal: String, project: MavenProject): MojoDescriptor? {
        return try {
            val pluginDescriptor = pluginManager.getPluginDescriptor(
                plugin,
                project.remotePluginRepositories,
                session.repositorySession
            )
            pluginDescriptor?.getMojo(goal)
        } catch (e: Exception) {
            log.warn("Failed to get MojoDescriptor for plugin ${plugin.artifactId} and goal $goal: ${e.message}")
            null
        }
    }


    /**
     * Analyzes parameter role based on Maven expressions and default values
     */
    private fun analyzeByExpression(parameter: Parameter): ParameterAnalysis {
        val expr = parameter.expression ?: parameter.defaultValue
        if (expr.isNullOrEmpty()) {
            return ParameterAnalysis(ParameterRole.UNKNOWN, 0.0f, "No expression or default value")
        }

        return when {
            // Input patterns in expressions
            expr.contains("project.compileSourceRoots") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.95f, "Maven source roots expression")
            expr.contains("project.testCompileSourceRoots") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.95f, "Maven test source roots expression")
            expr.contains("project.build.sourceDirectory") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.9f, "Maven source directory expression")
            expr.contains("project.build.testSourceDirectory") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.9f, "Maven test source directory expression")
            expr.contains("project.artifacts") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.9f, "Project artifacts dependency")
            expr.contains("project.dependencies") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.9f, "Project dependencies")
            expr.contains("project.build.resources") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.85f, "Maven resources expression")
            expr.contains("project.build.testResources") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.85f, "Maven test resources expression")
            expr.contains("basedir") -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.7f, "Project base directory")

            // Output patterns in expressions
            expr.contains("project.build.directory") && expr.contains("target") ->
                ParameterAnalysis(ParameterRole.OUTPUT, 0.95f, "Maven target directory expression")
            expr.contains("project.build.outputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, 0.9f, "Maven output directory expression")
            expr.contains("project.build.testOutputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, 0.9f, "Maven test output directory expression")
            expr.contains("project.reporting.outputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, 0.9f, "Maven reporting output directory")
            expr.contains("project.build.directory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, 0.8f, "Maven build directory expression")

            else -> ParameterAnalysis(ParameterRole.UNKNOWN, 0.0f, "Expression not recognized")
        }
    }

    /**
     * Analyzes parameter role based on type and editability
     */
    private fun analyzeByType(parameter: Parameter): ParameterAnalysis? {
        val type = parameter.type ?: return null

        // Non-editable parameters are typically inputs (derived from project model)
        if (!parameter.isEditable) {
            return ParameterAnalysis(
                ParameterRole.INPUT, 
                0.8f, 
                "Non-editable parameter (likely derived from project model)"
            )
        }

        return when {
            // Collection types with specific patterns
            type.startsWith("java.util.List") && parameter.required -> 
                ParameterAnalysis(ParameterRole.INPUT, 0.6f, "Required list parameter")
            
            // File types need further analysis by name/expression
            type == "java.io.File" || type == "java.nio.file.Path" -> null
            
            else -> null
        }
    }

    /**
     * Analyzes parameter role based on description text
     */
    private fun analyzeByDescription(parameter: Parameter): ParameterAnalysis {
        val description = parameter.description?.lowercase() ?: ""
        if (description.isEmpty()) {
            return ParameterAnalysis(ParameterRole.UNKNOWN, 0.0f, "No description available")
        }

        return when {
            // Input indicators in description
            description.contains("read") && (description.contains("file") || description.contains("directory")) ->
                ParameterAnalysis(ParameterRole.INPUT, 0.5f, "Description indicates reading files")
            description.contains("source") && description.contains("directory") ->
                ParameterAnalysis(ParameterRole.INPUT, 0.5f, "Description mentions source directory")
            description.contains("input") ->
                ParameterAnalysis(ParameterRole.INPUT, 0.4f, "Description mentions input")
            description.contains("classpath") ->
                ParameterAnalysis(ParameterRole.INPUT, 0.4f, "Description mentions classpath")

            // Output indicators in description
            description.contains("output") && (description.contains("file") || description.contains("directory")) ->
                ParameterAnalysis(ParameterRole.OUTPUT, 0.5f, "Description indicates output files")
            description.contains("target") && description.contains("directory") ->
                ParameterAnalysis(ParameterRole.OUTPUT, 0.5f, "Description mentions target directory")
            description.contains("generate") ->
                ParameterAnalysis(ParameterRole.OUTPUT, 0.4f, "Description mentions generating")
            description.contains("destination") ->
                ParameterAnalysis(ParameterRole.OUTPUT, 0.4f, "Description mentions destination")

            else -> ParameterAnalysis(ParameterRole.UNKNOWN, 0.0f, "Description not conclusive")
        }
    }
}

enum class ParameterRole {
    INPUT,      // Parameter represents input files/data
    OUTPUT,     // Parameter represents output files/data  
    BOTH,       // Parameter can be both input and output
    UNKNOWN     // Unable to determine parameter role
}

data class ParameterAnalysis(
    val role: ParameterRole,
    val confidence: Float,  // 0.0 to 1.0
    val reason: String
)

data class PhaseInformation(
    val isThreadSafe: Boolean,
    val inputs: Set<String>,
    val outputs: Set<String>
)
