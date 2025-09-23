package dev.nx.maven.utils

import dev.nx.maven.GitIgnoreClassifier
import dev.nx.maven.cache.CacheConfig
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.slf4j.LoggerFactory
import java.io.File

data class MojoAnalysis(
    val inputs: Set<String>,
    val dependentTaskOutputInputs: Set<DependentTaskOutputs>,
    val outputs: Set<String>,
    val isCacheable: Boolean,
    val isThreadSafe: Boolean,
)

class MojoAnalyzer(
    private val expressionResolver: MavenExpressionResolver,
    private val pathResolver: PathFormatter,
    private val gitIgnoreClassifier: GitIgnoreClassifier,
) {
    private val log = LoggerFactory.getLogger(MojoAnalyzer::class.java)

    private val cacheConfig: CacheConfig by lazy {
        CacheConfig.DEFAULT
    }

    /**
     * Aggregates cacheability, thread-safety, and input/output metadata for a mojo.
     */
    fun analyzeMojo(
        pluginDescriptor: PluginDescriptor,
        goal: String,
        project: MavenProject
    ): MojoAnalysis? {
        val mojoDescriptor = pluginDescriptor.getMojo(goal)
            ?: run {
                log.warn(
                    "Skipping analysis for ${pluginDescriptor.artifactId}:$goal – mojo descriptor not found"
                )
                return null
            }

        val isThreadSafe = mojoDescriptor.isThreadSafe

        val isCacheable = isPluginCacheable(pluginDescriptor, mojoDescriptor)

        if (!isCacheable) {
            log.info("${pluginDescriptor.artifactId}:$goal is not cacheable")
            return MojoAnalysis(emptySet(), emptySet(), emptySet(), false, isThreadSafe)
        }

        val (inputs, dependentTaskOutputInputs) = getInputs(pluginDescriptor, mojoDescriptor, project)
        val outputs = getOutputs(pluginDescriptor, mojoDescriptor, project)

        return MojoAnalysis(
            inputs,
            dependentTaskOutputInputs,
            outputs,
            true,
            isThreadSafe
        )
    }

    private fun getInputs(
        pluginDescriptor: PluginDescriptor,
        mojoDescriptor: MojoDescriptor,
        project: MavenProject
    ): Pair<Set<String>, Set<DependentTaskOutputs>> {
        val mojoConfig =
            cacheConfig.configurations["${pluginDescriptor.artifactId}:${mojoDescriptor.goal}"]

        val inputs = mutableSetOf<String>()
        val dependentTaskOutputInputs = mutableSetOf<DependentTaskOutputs>()

        mojoConfig?.inputParameters?.forEach { paramConfig ->
            val parameter = mojoDescriptor.parameterMap[paramConfig.name]
                ?: return@forEach

            val paths = expressionResolver.resolveParameter(parameter, project)

            paths.forEach { path ->
                val pathWithGlob = paramConfig.glob?.let { "$path/$it" } ?: path
                val pathFile = File(pathWithGlob);
                val isIgnored = gitIgnoreClassifier.isIgnored(pathFile)
                if (isIgnored) {
                    log.warn("Input path is gitignored: ${pathFile.path}")
                    val input = pathResolver.toDependentTaskOutputs(pathFile, project.basedir)
                    dependentTaskOutputInputs.add(input)
                } else {
                    val input = pathResolver.formatInputPath(pathFile, projectRoot = project.basedir)

                    inputs.add(input)
                }
            }
        }

        mojoConfig?.inputProperties?.forEach { propertyPath ->
            val paths = expressionResolver.resolveProperty(propertyPath, project)

            paths.forEach { path ->
                val pathFile = File(path)
                val isIgnored = gitIgnoreClassifier.isIgnored(pathFile)
                if (isIgnored) {
                    log.warn("Input path is gitignored: ${pathFile.path}")
                    val input = pathResolver.toDependentTaskOutputs(pathFile, project.basedir)
                    dependentTaskOutputInputs.add(input)
                } else {
                    val input = pathResolver.formatInputPath(pathFile, projectRoot = project.basedir)

                    inputs.add(input)
                }
            }
        }

        if (inputs.isEmpty() && dependentTaskOutputInputs.isEmpty()) {
            cacheConfig.defaultInputs.forEach { input ->
                val pathFile = File(input.path);
                val isIgnored = gitIgnoreClassifier.isIgnored(pathFile)
                if (isIgnored) {
                    log.warn("Input path is gitignored: ${pathFile.path}")
                    val input = pathResolver.toDependentTaskOutputs(pathFile, project.basedir)
                    dependentTaskOutputInputs.add(input)
                } else {
                    val input = pathResolver.formatInputPath(pathFile, projectRoot = project.basedir)

                    inputs.add(input)
                }
            }
        }

        return Pair(inputs, dependentTaskOutputInputs)
    }

    private fun getOutputs(
        pluginDescriptor: PluginDescriptor,
        mojoDescriptor: MojoDescriptor,
        project: MavenProject
    ): Set<String> {
        val pluginConfig = cacheConfig.configurations["${pluginDescriptor.artifactId}:${mojoDescriptor.goal}"] ?: return mavenFallbackOutputs

        val outputs = mutableSetOf<String>()
        if (pluginConfig.outputParameters.isEmpty()) {
            return outputs
        }

        pluginConfig.outputParameters.forEach { paramConfig ->
            val parameter = mojoDescriptor.parameterMap[paramConfig.name]
                ?: return@forEach

            val paths = expressionResolver.resolveParameter(
                parameter,
                project
            )

            paths.forEach { path ->
                val pathWithGlob = paramConfig.glob?.let { "${path}/$it" } ?: path
                val pathFile = File(pathWithGlob);

                val formattedPath = pathResolver.formatOutputPath(pathFile, project.basedir)

                outputs.add(formattedPath)
            }
        }

        if (outputs.isEmpty()) {
            return cacheConfig.defaultOutputs.map { output ->
                val pathFile = File(output.path);
                pathResolver.formatOutputPath(
                    pathFile,
                    project.basedir
                )
            }.toSet()
        }

        return outputs
    }


    /**
     * Formats a path for Nx compatibility by adding {projectRoot} prefix for relative paths
     */
    private fun formatPathForNx(path: String): String {
        return when {
            // Already has Nx interpolation
            path.startsWith("{") -> path
            // Absolute paths stay as-is (though not recommended for Nx)
            path.startsWith("/") -> path
            // Relative paths get {projectRoot} prefix
            else -> "{projectRoot}/$path"
        }
    }


    private fun isPluginCacheable(pluginDescriptor: PluginDescriptor, mojoDescriptor: MojoDescriptor): Boolean {
        return !cacheConfig.nonCacheable.contains("${pluginDescriptor.artifactId}:${mojoDescriptor.goal}")
    }

    internal val mavenFallbackInputs: Set<String> by lazy {
        val inputs = mutableSetOf(
            "src/main/java",
            "src/test/java",
            "src/main/resources",
            "src/test/resources",
            "pom.xml"
        )

        cacheConfig.defaultInputs.forEach { include ->
            when (include.path) {
                "." -> {
                    // Root directory includes (like pom.xml) are already covered above
                }

                else -> inputs.add(include.path)
            }
        }

        inputs.map { formatPathForNx(it) }.toSet()
    }

    internal val mavenFallbackOutputs: Set<String> by lazy {
        val outputs = mutableSetOf(
            "target/classes",
            "target/test-classes",
            "target"
        )

        outputs.map { formatPathForNx(it) }.toSet()
    }

}
