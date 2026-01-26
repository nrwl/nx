package dev.nx.maven

import com.google.gson.GsonBuilder
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.nx.maven.targets.NxTargetFactory
import dev.nx.maven.targets.TestClassDiscovery
import dev.nx.maven.utils.MavenExpressionResolver
import dev.nx.maven.utils.MojoAnalyzer
import dev.nx.maven.utils.PathFormatter
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.DefaultLifecycles
import org.apache.maven.plugin.AbstractMojo
import org.apache.maven.plugin.MojoExecutionException
import org.apache.maven.plugins.annotations.*
import org.apache.maven.project.MavenProject
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File

/**
 * Maven plugin to analyze project structure and generate JSON for Nx integration
 */
@Mojo(
  name = "analyze",
  aggregator = true,
  requiresDependencyResolution = ResolutionScope.NONE
)
class NxProjectAnalyzerMojo : AbstractMojo() {

  private val log: Logger = LoggerFactory.getLogger(NxProjectAnalyzerMojo::class.java)

  @Parameter(defaultValue = "\${session}", readonly = true, required = true)
  private lateinit var session: MavenSession

  @Component
  private lateinit var pluginManager: org.apache.maven.plugin.MavenPluginManager

  @Component
  private lateinit var lifecycles: DefaultLifecycles

  @Parameter(property = "outputFile", defaultValue = "nx-maven-projects.json")
  private lateinit var outputFile: String

  @Parameter(property = "workspaceRoot", defaultValue = "\${session.executionRootDirectory}")
  private lateinit var workspaceRoot: File

  @Parameter(property = "targetNamePrefix")
  private var targetNamePrefix: String? = null

  private val gson = GsonBuilder().setPrettyPrinting().create()

  @Throws(MojoExecutionException::class)
  override fun execute() {
    log.info("Analyzing Maven projects using optimized two-tier approach...")
    log.info("Parameters: outputFile='$outputFile', workspaceRoot='$workspaceRoot'")

    // Canonicalize workspace root in place to resolve symlinks (e.g., /tmp -> /private/tmp on macOS)
    workspaceRoot = workspaceRoot.canonicalFile
    log.info("Canonical workspace root: $workspaceRoot")

    try {
      val allProjects = session.allProjects
      log.info("Found ${allProjects.size} Maven projects")

      // Step 1: Execute per-project analysis for all projects (in-memory)
      log.info("Step 1: Running optimized per-project analysis...")
      val inMemoryAnalyses = executePerProjectAnalysisInMemory(allProjects)

      // Step 2: Write project analyses to output file
      log.info("Step 2: Writing project analyses to output file...")
      writeProjectAnalysesToFile(inMemoryAnalyses)

      log.info("Optimized two-tier analysis completed successfully")

    } catch (e: Exception) {
      throw MojoExecutionException("Failed to execute optimized two-tier Maven analysis", e)
    }
  }

  private fun executePerProjectAnalysisInMemory(
    allProjects: List<MavenProject>
  ): List<ProjectAnalysis> {

    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)
    val startTime = System.currentTimeMillis()
    log.info("Creating shared component instances for optimized analysis...")

    // Create deeply shared components for maximum caching efficiency
    val sharedExpressionResolver = MavenExpressionResolver(session)

    // Create shared component instances ONCE for all projects (major optimization)

    val pathFormatter = PathFormatter()
    val mojoAnalyzer = MojoAnalyzer(sharedExpressionResolver, pathFormatter, gitIgnoreClassifier)

    val sharedTestClassDiscovery = TestClassDiscovery()

    val sharedTargetFactory = NxTargetFactory(
      lifecycles,
      sharedTestClassDiscovery,
      pluginManager,
      session,
      mojoAnalyzer,
      pathFormatter,
      gitIgnoreClassifier,
      targetNamePrefix ?: ""
    )

    val setupTime = System.currentTimeMillis() - startTime
    log.info("Shared components created in ${setupTime}ms, analyzing ${allProjects.size} projects...")

    val projectStartTime = System.currentTimeMillis()

    // Generate coordinates map from all projects
    val coordinatesMap = generateCoordinatesMap(pathFormatter, allProjects);

    // Process projects in parallel with separate analyzer instances
    val results = allProjects.parallelStream().map { mavenProject ->
      try {
        log.info("Analyzing project: ${mavenProject.artifactId}")

        // Create separate analyzer instance for each project (thread-safe)
        val singleAnalyzer = NxProjectAnalyzer(
          mavenProject,
          workspaceRoot,
          sharedTargetFactory,
          coordinatesMap,
          pathFormatter
        )

        // Get Nx config for project
        val nxConfig = singleAnalyzer.analyze()

        Result.success(nxConfig)

      } catch (e: Exception) {
        Result.failure(e)
      }
    }.collect(java.util.stream.Collectors.toList())

    val errors = results.filter { it.isFailure }

    if (errors.isNotEmpty()) {
      errors.forEach { error ->
        log.error("Failed to analyze project", error.exceptionOrNull())
      }

      throw MojoExecutionException("Failed to analyze ${errors.size} of ${allProjects.size} projects. See errors above.")
    }

    val inMemoryAnalyses = results.map { it.getOrThrow() }

    val totalTime = System.currentTimeMillis() - startTime
    val analysisTime = System.currentTimeMillis() - projectStartTime
    log.info("Completed in-memory analysis of ${allProjects.size} projects in ${totalTime}ms (setup: ${setupTime}ms, analysis: ${analysisTime}ms)")

    return inMemoryAnalyses
  }

  private fun writeProjectAnalysesToFile(inMemoryAnalyses: List<ProjectAnalysis>) {
    val outputPath = if (File(outputFile).isAbsolute) {
      File(outputFile)
    } else {
      File(workspaceRoot, outputFile)
    }

    // Ensure parent directory exists
    outputPath.parentFile?.mkdirs()

    // Create JSON structure with both project analyses and createNodesResults
    val rootNode = JsonObject()
    val projectsNode = JsonObject()

    // Skip project analyses section - all data is in createNodesResults
    rootNode.add("projects", projectsNode)

    // Generate createNodesResults for Nx plugin consumption
    val createNodesResults = generateCreateNodesResults(inMemoryAnalyses)
    rootNode.add("createNodesResults", createNodesResults)


    val createDependenciesResults = generateCreateDependenciesResults(inMemoryAnalyses)
    rootNode.add("createDependenciesResults", createDependenciesResults)

    // Add metadata
    rootNode.addProperty("totalProjects", inMemoryAnalyses.size)
    rootNode.addProperty("workspaceRoot", workspaceRoot.absolutePath)
    rootNode.addProperty("analysisMethod", "optimized-parallel")
    rootNode.addProperty("analyzedProjects", inMemoryAnalyses.size)

    outputPath.writeText(gson.toJson(rootNode))
    log.info("Generated project analyses with ${inMemoryAnalyses.size} projects: ${outputPath.absolutePath}")
  }

  private fun generateCreateDependenciesResults(projectAnalyses: List<ProjectAnalysis>): JsonArray {
    val result = JsonArray()
    projectAnalyses.forEach { analysis ->
      analysis.dependencies.forEach { dependency -> result.add(dependency) }
    }
    return result
  }

  private fun generateCreateNodesResults(inMemoryAnalyses: List<ProjectAnalysis>): JsonArray {
    val createNodesResults = JsonArray()

    inMemoryAnalyses.forEach { analysis ->
      val resultTuple = JsonArray()
      resultTuple.add(analysis.pomFile.canonicalFile.relativeTo(workspaceRoot).path) // Root path (workspace root)

      // Group projects by root directory (for now, assume all projects are at workspace root)
      val projects = JsonObject()

      val root = analysis.root
      val project = analysis.project

      val projectsWrapper = JsonObject()
      projects.add(root, project)
      projectsWrapper.add("projects", projects)
      resultTuple.add(projectsWrapper)

      createNodesResults.add(resultTuple)
    }

    return createNodesResults
  }

  private fun generateCoordinatesMap(
    pathFormatter: PathFormatter,
    projects: List<MavenProject>
  ): Map<String, String> =
    projects.associate { project ->
      "${project.groupId}:${project.artifactId}" to pathFormatter.normalizeRelativePath(project.basedir.canonicalFile.relativeTo(workspaceRoot).path)
    }
}
