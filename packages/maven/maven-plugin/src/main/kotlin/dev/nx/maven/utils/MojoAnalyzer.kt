package dev.nx.maven.utils

import dev.nx.maven.cache.CacheConfig
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.slf4j.LoggerFactory
import java.io.File

data class MojoAnalysis(
  val inputs: Set<String>,
  val ignoredInputs: Set<String>,
  val outputs: Set<String>,
  val isCacheable: Boolean,
  val isContinuous: Boolean,
)

class MojoAnalyzer(
  private val expressionResolver: MavenExpressionResolver,
  private val pathResolver: PathFormatter,
  private val workspaceRoot: File,
) {
  private val log = LoggerFactory.getLogger(MojoAnalyzer::class.java)

  private val cacheConfig: CacheConfig by lazy {
    CacheConfig.DEFAULT
  }

  /**
   * Aggregates cacheability and input/output metadata for a mojo.
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

    val isCacheable = isPluginCacheable(pluginDescriptor, mojoDescriptor)

    val isContinuous = isPluginContinuous(pluginDescriptor, mojoDescriptor)

    if (!isCacheable) {
      log.info("${pluginDescriptor.artifactId}:$goal is not cacheable")
      // Still hashed, but only from an explicit config: the src defaults don't fit these goals.
      val configured = cacheConfig.configurations.containsKey("${pluginDescriptor.artifactId}:$goal")
      val (inputs, ignoredInputs) =
        if (configured) getInputs(pluginDescriptor, mojoDescriptor, project) else Pair(emptySet(), emptySet())
      return MojoAnalysis(inputs, ignoredInputs, emptySet(), false, isContinuous)
    }

    val (inputs, ignoredInputs) = getInputs(pluginDescriptor, mojoDescriptor, project)
    val outputs = getOutputs(pluginDescriptor, mojoDescriptor, project)

    return MojoAnalysis(
      inputs,
      ignoredInputs,
      outputs,
      true,
      isContinuous,
    )
  }

  private fun getInputs(
    pluginDescriptor: PluginDescriptor,
    mojoDescriptor: MojoDescriptor,
    project: MavenProject
  ): Pair<Set<String>, Set<String>> {
    val mojoConfig =
      cacheConfig.configurations["${pluginDescriptor.artifactId}:${mojoDescriptor.goal}"]

    val inputs = mutableSetOf<String>()
    val ignoredInputs = mutableSetOf<String>()

    // Maven reads these paths whether git tracks them or not, so they're hashed from disk.
    fun addInput(path: String, glob: String?, excludeGlob: String?) {
      val pathWithGlob = File(glob?.let { "$path/$it" } ?: path)
      // includeIgnored filesets reject `..`
      fun format(file: File) = if (File(path).isUnder(project.basedir)) {
        pathResolver.formatInputPath(file, projectRoot = project.basedir)
      } else {
        pathResolver.toWorkspacePath(file, workspaceRoot)
      }
      ignoredInputs.add(format(pathWithGlob))
      excludeGlob?.let { ignoredInputs.add("!" + format(File("$path/$it"))) }
    }

    mojoConfig?.inputParameters?.forEach { paramConfig ->
      val parameter = mojoDescriptor.parameterMap[paramConfig.name]
        ?: return@forEach

      expressionResolver.resolveParameter(parameter, project)
        .forEach { addInput(it, paramConfig.glob, paramConfig.excludeGlob) }
    }

    mojoConfig?.inputProperties?.forEach { property ->
      expressionResolver.resolveProperty(property.name, project)
        .forEach { addInput(it, property.glob, property.excludeGlob) }
    }

    if (mojoConfig?.inputParameters == null && mojoConfig?.inputProperties == null) {
      cacheConfig.defaultInputs.forEach { input ->
        ignoredInputs.add(pathResolver.formatInputPath(File(input.path), projectRoot = project.basedir))
      }
    }

    inputs.addAll(pomInputs(project))

    return Pair(inputs, ignoredInputs)
  }

  /** The module's pom.xml and its in-workspace ancestor poms. */
  fun pomInputs(project: MavenProject): Set<String> {
    val inputs = mutableSetOf<String>()
    val canonicalWorkspaceRoot = workspaceRoot.canonicalPath
    val canonicalProjectRoot = project.basedir.canonicalPath
    var currentProject: MavenProject? = project
    while (currentProject != null) {
      val pomFile = File(currentProject.basedir, "pom.xml")
      val canonicalPomPath = pomFile.canonicalPath
      if (pomFile.exists() && canonicalPomPath.startsWith(canonicalWorkspaceRoot)) {
        val pomInput = if (canonicalPomPath.startsWith(canonicalProjectRoot)) {
          // Within project directory - use {projectRoot}
          pathResolver.formatInputPath(pomFile, projectRoot = project.basedir)
        } else {
          // Outside project directory - use {workspaceRoot}
          pathResolver.toWorkspacePath(pomFile, workspaceRoot)
        }
        inputs.add(pomInput)
      }
      currentProject = currentProject.parent
    }
    return inputs
  }

  private fun getOutputs(
    pluginDescriptor: PluginDescriptor,
    mojoDescriptor: MojoDescriptor,
    project: MavenProject
  ): Set<String> {
    val mojoConfig = cacheConfig.configurations["${pluginDescriptor.artifactId}:${mojoDescriptor.goal}"]

    val outputs = mutableSetOf<String>()
    mojoConfig?.outputParameters?.forEach { paramConfig ->
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

        paramConfig.excludeGlob?.let {
          outputs.add("!" + pathResolver.formatOutputPath(File("$path/$it"), project.basedir))
        }
      }
    }

    if (mojoConfig?.outputParameters == null) {
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

  private fun isPluginContinuous(pluginDescriptor: PluginDescriptor, mojoDescriptor: MojoDescriptor): Boolean {
    return cacheConfig.continuous.contains("${pluginDescriptor.artifactId}:${mojoDescriptor.goal}")
  }

  private fun isPluginCacheable(pluginDescriptor: PluginDescriptor, mojoDescriptor: MojoDescriptor): Boolean {
    return !cacheConfig.nonCacheable.contains("${pluginDescriptor.artifactId}:${mojoDescriptor.goal}")
  }
}
