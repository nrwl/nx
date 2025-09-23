package dev.nx.maven.utils

import dev.nx.maven.GitIgnoreClassifier
import dev.nx.maven.cache.CacheConfig
import dev.nx.maven.cache.CacheConfigLoader
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
        CacheConfigLoader().loadConfig("/nx-cache-config.xml")
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

        val isCacheable = isPluginCacheable(pluginDescriptor)

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
        val pluginConfig = cacheConfig.plugins[pluginDescriptor.artifactId] ?: return Pair(mavenFallbackInputs, emptySet())

        val inputs = mutableSetOf<String>()
        val dependentTaskOutputInputs = mutableSetOf<DependentTaskOutputs>()
        if (pluginConfig.inputParameters.isEmpty()) {
            return Pair(mavenFallbackInputs, emptySet())
        }

        pluginConfig.inputParameters.forEach { input ->
            val parameter = mojoDescriptor.parameterMap[input.path]
                ?: return@forEach

            var path = expressionResolver.resolveParameterValue(
                parameter.name,
                parameter.defaultValue,
                parameter.expression,
                project
            )

            if (path == null) {
                log.debug("Parameter ${parameter.name} resolved to null path")
                return@forEach
            }

            if (input.glob != null) {
                path = "$path/${input.glob}"
            }

            val pathFile = File(path);
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


        cacheConfig.globalIncludes.forEach { include ->
            var path = include.path
            include.glob?.let { glob -> path += "/$glob" }

            val pathFile = File(path);

            if (gitIgnoreClassifier.isIgnored(pathFile)) {
                log.warn("Input path is gitignored: ${pathFile.path}")
                val input = pathResolver.toDependentTaskOutputs(pathFile, project.basedir)
                dependentTaskOutputInputs.add(input)
            } else {
                val input = pathResolver.formatInputPath(pathFile, projectRoot = project.basedir)

                inputs.add(input)
            }

            // TODO: This is not supported by nx yet
//            if (include.recursive) {
//                aggregatedInputs.add("^$formatted")
//            }
        }

        cacheConfig.globalExcludes.forEach { exclude ->
            var path = exclude.path
            exclude.glob?.let { glob -> path += "/$glob" }

            val formatted = pathResolver.formatInputPath(File(path), project.basedir)
            inputs.add("!$formatted")
            log.debug("Added global exclude input path: !$formatted")
        }

        return Pair(inputs, dependentTaskOutputInputs)
    }

    private fun getOutputs(
        pluginDescriptor: PluginDescriptor,
        mojoDescriptor: MojoDescriptor,
        project: MavenProject
    ): Set<String> {
        val pluginConfig = cacheConfig.plugins[pluginDescriptor.artifactId] ?: return mavenFallbackInputs

        val outputs = mutableSetOf<String>()
        if (pluginConfig.outputParameters.isEmpty()) {
            return outputs
        }

        pluginConfig.outputParameters.forEach { ouptut ->
            val parameter = mojoDescriptor.parameterMap[ouptut.path]
                ?: return@forEach

            var path = expressionResolver.resolveParameterValue(
                parameter.name,
                parameter.defaultValue,
                parameter.expression,
                project
            )

            if (path == null) {
                log.debug("Parameter ${parameter.name} resolved to null path")
                return@forEach
            }

            if (ouptut.glob != null) {
                path = "$path/${ouptut.glob}"
            }

            val formattedPath = pathResolver.formatOutputPath(File(path), project.basedir)

            outputs.add(formattedPath)
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


    private fun isPluginCacheable(descriptor: PluginDescriptor): Boolean {
        return !cacheConfig.alwaysRunPlugins.contains(descriptor.artifactId)
    }

    internal val mavenFallbackInputs: Set<String> by lazy {
        val inputs = mutableSetOf(
            "src/main/java",
            "src/test/java",
            "src/main/resources",
            "src/test/resources",
            "pom.xml"
        )

        cacheConfig.globalIncludes.forEach { include ->
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
