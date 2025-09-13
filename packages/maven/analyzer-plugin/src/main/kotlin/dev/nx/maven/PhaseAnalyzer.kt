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
            "source" to ParameterAnalysis(ParameterRole.INPUT, "Java source version"),
            "target" to ParameterAnalysis(ParameterRole.INPUT, "Java target version"),
            "compileSourceRoots" to ParameterAnalysis(ParameterRole.INPUT, "Source root directories"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "Compiled classes output"),
            "classpathElements" to ParameterAnalysis(ParameterRole.INPUT, "Compilation classpath")
        ),
        "maven-compiler-plugin:testCompile" to mapOf(
            "testSource" to ParameterAnalysis(ParameterRole.INPUT, "Java test source version"),
            "testTarget" to ParameterAnalysis(ParameterRole.INPUT, "Java test target version"),
            "testCompileSourceRoots" to ParameterAnalysis(ParameterRole.INPUT, "Test source directories"),
            "testOutputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "Compiled test classes output"),
            "testClasspathElements" to ParameterAnalysis(ParameterRole.INPUT, "Test compilation classpath")
        ),

        // Maven Surefire Plugin (Testing)
        "maven-surefire-plugin:test" to mapOf(
            "testSourceDirectory" to ParameterAnalysis(ParameterRole.INPUT, "Test source directory"),
            "testClassesDirectory" to ParameterAnalysis(ParameterRole.INPUT, "Compiled test classes"),
            "reportsDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "Test reports output"),
            "testClasspathElements" to ParameterAnalysis(ParameterRole.INPUT, "Test runtime classpath"),
            "includes" to ParameterAnalysis(ParameterRole.INPUT, "Test include patterns"),
            "excludes" to ParameterAnalysis(ParameterRole.INPUT, "Test exclude patterns")
        ),

        // Maven Resources Plugin
        "maven-resources-plugin:resources" to mapOf(
            "resources" to ParameterAnalysis(ParameterRole.INPUT, "Resource directories"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "Resources output directory")
        ),
        "maven-resources-plugin:testResources" to mapOf(
            "testResources" to ParameterAnalysis(ParameterRole.INPUT, "Test resource directories"),
            "testOutputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "Test resources output")
        ),

        // Maven JAR Plugin
        "maven-jar-plugin:jar" to mapOf(
            "classesDirectory" to ParameterAnalysis(ParameterRole.INPUT, "Compiled classes directory"),
            "outputDirectory" to ParameterAnalysis(ParameterRole.OUTPUT, "JAR output directory"),
            "finalName" to ParameterAnalysis(ParameterRole.OUTPUT, "JAR file name")
        ),

        // Maven Clean Plugin
        "maven-clean-plugin:clean" to mapOf(
            "directory" to ParameterAnalysis(ParameterRole.OUTPUT, "Directory to clean"),
            "filesets" to ParameterAnalysis(ParameterRole.OUTPUT, "File sets to clean")
        ),

        // Maven Install Plugin
        "maven-install-plugin:install" to mapOf(
            "file" to ParameterAnalysis(ParameterRole.INPUT, "Artifact file to install"),
            "localRepository" to ParameterAnalysis(ParameterRole.OUTPUT, "Local repository location")
        ),

        // Maven Deploy Plugin
        "maven-deploy-plugin:deploy" to mapOf(
            "file" to ParameterAnalysis(ParameterRole.INPUT, "Artifact file to deploy"),
            "repositoryId" to ParameterAnalysis(ParameterRole.INPUT, "Target repository ID"),
            "url" to ParameterAnalysis(ParameterRole.INPUT, "Repository URL")
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
                val paramInfo = analyzeParameterWithConfidence(parameter, project)
                inputs.addAll(paramInfo.inputs)
                outputs.addAll(paramInfo.outputs)
            }
        }

        return PhaseInformation(isThreadSafe, inputs, outputs)
    }

    /**
     * Analyzes parameter using combined strategy with confidence scoring
     */
    private fun analyzeParameterWithConfidence(parameter: Parameter, project: MavenProject): ParameterInformation {
        val name = parameter.name
        val type = parameter.type
        
        val inputs = mutableSetOf<String>()
        val outputs = mutableSetOf<String>()
        
        val analysis = analyzeParameterRole(parameter, project)
        
        log.debug("Parameter analysis: $name -> ${analysis.role} (reason: ${analysis.reason})")

        if (analysis.role == ParameterRole.UNKNOWN) {
            log.debug("Skipping unknown parameter: $name")
            return ParameterInformation(inputs, outputs)
        }

        val path = expressionResolver.resolveParameterValue(
            name, 
            parameter.defaultValue, 
            parameter.expression, 
            project
        )
        
        if (path == null) {
            log.debug("Parameter $name resolved to null path")
            return ParameterInformation(inputs, outputs)
        }

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
                // Won't reach here due to the early return above
            }
        }
        
        return ParameterInformation(inputs, outputs)
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
        
        return ParameterAnalysis(ParameterRole.UNKNOWN, "No analysis strategy succeeded")
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
            return ParameterAnalysis(ParameterRole.UNKNOWN, "No expression or default value")
        }

        return when {
            // Input patterns in expressions
            expr.contains("project.compileSourceRoots") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven source roots expression")
            expr.contains("project.testCompileSourceRoots") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven test source roots expression")
            expr.contains("project.build.sourceDirectory") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven source directory expression")
            expr.contains("project.build.testSourceDirectory") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven test source directory expression")
            expr.contains("project.artifacts") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Project artifacts dependency")
            expr.contains("project.dependencies") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Project dependencies")
            expr.contains("project.build.resources") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven resources expression")
            expr.contains("project.build.testResources") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Maven test resources expression")
            expr.contains("basedir") -> 
                ParameterAnalysis(ParameterRole.INPUT, "Project base directory")

            // Output patterns in expressions
            expr.contains("project.build.directory") && expr.contains("target") ->
                ParameterAnalysis(ParameterRole.OUTPUT, "Maven target directory expression")
            expr.contains("project.build.outputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, "Maven output directory expression")
            expr.contains("project.build.testOutputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, "Maven test output directory expression")
            expr.contains("project.reporting.outputDirectory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, "Maven reporting output directory")
            expr.contains("project.build.directory") -> 
                ParameterAnalysis(ParameterRole.OUTPUT, "Maven build directory expression")

            else -> ParameterAnalysis(ParameterRole.UNKNOWN, "Expression not recognized")
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
                "Non-editable parameter (likely derived from project model)"
            )
        }

        return when {
            // Collection types with specific patterns
            type.startsWith("java.util.List") && parameter.required -> 
                ParameterAnalysis(ParameterRole.INPUT, "Required list parameter")
            
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
            return ParameterAnalysis(ParameterRole.UNKNOWN, "No description available")
        }

        return when {
            // Input indicators in description
            description.contains("read") && (description.contains("file") || description.contains("directory")) ->
                ParameterAnalysis(ParameterRole.INPUT, "Description indicates reading files")
            description.contains("source") && description.contains("directory") ->
                ParameterAnalysis(ParameterRole.INPUT, "Description mentions source directory")
            description.contains("input") ->
                ParameterAnalysis(ParameterRole.INPUT, "Description mentions input")
            description.contains("classpath") ->
                ParameterAnalysis(ParameterRole.INPUT, "Description mentions classpath")

            // Output indicators in description
            description.contains("output") && (description.contains("file") || description.contains("directory")) ->
                ParameterAnalysis(ParameterRole.OUTPUT, "Description indicates output files")
            description.contains("target") && description.contains("directory") ->
                ParameterAnalysis(ParameterRole.OUTPUT, "Description mentions target directory")
            description.contains("generate") ->
                ParameterAnalysis(ParameterRole.OUTPUT, "Description mentions generating")
            description.contains("destination") ->
                ParameterAnalysis(ParameterRole.OUTPUT, "Description mentions destination")

            else -> ParameterAnalysis(ParameterRole.UNKNOWN, "Description not conclusive")
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
    val reason: String
)

data class ParameterInformation(
    val inputs: Set<String>,
    val outputs: Set<String>
)

data class PhaseInformation(
    val isThreadSafe: Boolean,
    val inputs: Set<String>,
    val outputs: Set<String>
)
