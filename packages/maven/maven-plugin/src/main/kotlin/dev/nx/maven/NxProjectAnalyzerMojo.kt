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
import org.apache.maven.model.io.xpp3.MavenXpp3Reader
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.File
import java.io.FileReader

/**
 * Maven plugin to analyze project structure and generate JSON for Nx integration
 */
@Mojo(
  name = "analyze",
  aggregator = true,
  requiresDependencyResolution = ResolutionScope.COMPILE
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
    val mojoAnalyzer = MojoAnalyzer(sharedExpressionResolver, pathFormatter, gitIgnoreClassifier, workspaceRoot)

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
    val pathFormatter = PathFormatter()

    projectAnalyses.forEach { analysis ->
      // Add workspace project dependencies
      analysis.dependencies.forEach { dependency -> result.add(dependency) }

      // Add external dependencies (project -> external node)
      val canonicalWorkspaceRoot = workspaceRoot.canonicalFile
      val sourceRoot = analysis.root
      analysis.externalDependencies.forEach { extDep ->
        val dependency = JsonObject()
        dependency.addProperty("type", "static")
        dependency.addProperty("source", sourceRoot)
        dependency.addProperty("target", "maven:${extDep.groupId}:${extDep.artifactId}")
        dependency.addProperty("sourceFile", pathFormatter.normalizeRelativePath(
          analysis.pomFile.canonicalFile.relativeTo(canonicalWorkspaceRoot).path
        ))
        result.add(dependency)
      }
    }

    // Add external-to-external edges
    val allExternalDeps = projectAnalyses.flatMap { it.externalDependencies }
    val externalEdges = generateExternalEdges(allExternalDeps)
    externalEdges.forEach { result.add(it) }

    return result
  }

  private fun generateCreateNodesResults(inMemoryAnalyses: List<ProjectAnalysis>): JsonArray {
    val createNodesResults = JsonArray()

    // Build a deduplicated map of all external nodes across all projects
    val allExternalNodes = generateExternalNodes(inMemoryAnalyses)

    inMemoryAnalyses.forEach { analysis ->
      val resultTuple = JsonArray()
      resultTuple.add(analysis.pomFile.canonicalFile.relativeTo(workspaceRoot).path) // Root path (workspace root)

      val projects = JsonObject()

      val root = analysis.root
      val project = analysis.project

      val projectsWrapper = JsonObject()
      projects.add(root, project)
      projectsWrapper.add("projects", projects)

      // Embed external nodes in each tuple (matching Gradle pattern)
      if (allExternalNodes.size() > 0) {
        projectsWrapper.add("externalNodes", allExternalNodes)
      }

      resultTuple.add(projectsWrapper)

      createNodesResults.add(resultTuple)
    }

    return createNodesResults
  }

  private fun generateExternalNodes(projectAnalyses: List<ProjectAnalysis>): JsonObject {
    val externalNodes = JsonObject()

    // Deduplicate external deps across all projects by groupId:artifactId
    val seen = mutableMapOf<String, ExternalMavenDependency>()
    projectAnalyses.forEach { analysis ->
      analysis.externalDependencies.forEach { extDep ->
        val key = "${extDep.groupId}:${extDep.artifactId}"
        // Keep the first occurrence (or one with a version if the existing one has none)
        val existing = seen[key]
        if (existing == null || (existing.version == null && extDep.version != null)) {
          seen[key] = extDep
        }
      }
    }

    // Create external node JSON for each unique dependency
    seen.forEach { (coordinates, extDep) ->
      val nodeName = "maven:${coordinates}"
      val node = JsonObject()
      node.addProperty("type", "maven")
      node.addProperty("name", nodeName)

      val data = JsonObject()
      data.addProperty("packageName", coordinates)
      data.addProperty("groupId", extDep.groupId)
      data.addProperty("artifactId", extDep.artifactId)
      data.addProperty("version", extDep.version ?: "managed")
      node.add("data", data)

      externalNodes.add(nodeName, node)
    }

    return externalNodes
  }

  private fun generateExternalEdges(allExternalDeps: List<ExternalMavenDependency>): List<JsonObject> {
    val edges = mutableListOf<JsonObject>()
    val localRepo = session.repositorySession.localRepository.basedir
    val reader = MavenXpp3Reader()

    // Build set of known external node keys for quick lookup
    val externalNodeKeys = allExternalDeps
      .map { "${it.groupId}:${it.artifactId}" }
      .toSet()

    // Deduplicate: only process each groupId:artifactId once
    val seen = mutableSetOf<String>()
    val uniqueDeps = allExternalDeps.filter { seen.add("${it.groupId}:${it.artifactId}") }

    for (dep in uniqueDeps) {
      val version = dep.version ?: continue
      val pomPath = File(
        localRepo,
        "${dep.groupId.replace('.', '/')}/${dep.artifactId}/${version}/${dep.artifactId}-${version}.pom"
      )

      if (!pomPath.exists()) continue

      try {
        val model = FileReader(pomPath).use { reader.read(it) }
        model.dependencies?.forEach { pomDep ->
          val targetKey = "${pomDep.groupId}:${pomDep.artifactId}"
          if (externalNodeKeys.contains(targetKey)) {
            val edge = JsonObject()
            edge.addProperty("type", "static")
            edge.addProperty("source", "maven:${dep.groupId}:${dep.artifactId}")
            edge.addProperty("target", "maven:${targetKey}")
            edges.add(edge)
          }
        }
      } catch (e: Exception) {
        log.debug("Could not parse POM for ${dep.groupId}:${dep.artifactId}:${version}: ${e.message}")
      }
    }

    log.info("Generated ${edges.size} external-to-external dependency edges")
    return edges
  }

  private fun generateCoordinatesMap(
    pathFormatter: PathFormatter,
    projects: List<MavenProject>
  ): Map<String, String> =
    projects.associate { project ->
      "${project.groupId}:${project.artifactId}" to pathFormatter.normalizeRelativePath(project.basedir.canonicalFile.relativeTo(workspaceRoot).path)
    }
}
