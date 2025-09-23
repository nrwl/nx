package dev.nx.maven

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import dev.nx.maven.targets.NxTargetFactory
import dev.nx.maven.targets.TestClassDiscovery
import dev.nx.maven.utils.MavenCommandResolver
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

    private val objectMapper = ObjectMapper()

    @Throws(MojoExecutionException::class)
    override fun execute() {
        log.info("Analyzing Maven projects using optimized two-tier approach...")
        log.info("Parameters: outputFile='$outputFile', workspaceRoot='$workspaceRoot'")

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
        try {
            val startTime = System.currentTimeMillis()
            log.info("Creating shared component instances for optimized analysis...")

            // Create deeply shared components for maximum caching efficiency
            val sharedExpressionResolver = MavenExpressionResolver(session)

            // Create shared component instances ONCE for all projects (major optimization)

            val pathResolver = PathFormatter(gitIgnoreClassifier)
            val mojoAnalyzer = MojoAnalyzer(sharedExpressionResolver, pathResolver, gitIgnoreClassifier)

            val sharedTestClassDiscovery = TestClassDiscovery()

            val sharedLifecycleAnalyzer = NxTargetFactory(
                lifecycles,
                objectMapper,
                sharedTestClassDiscovery,
                pluginManager,
                session,
                mojoAnalyzer
            )

            // Resolve Maven command once for all projects
            val mavenCommandStart = System.currentTimeMillis()
            val mavenCommand = MavenCommandResolver.getMavenCommand(workspaceRoot)
            val mavenCommandTime = System.currentTimeMillis() - mavenCommandStart
            log.info("Maven command resolved to '$mavenCommand' in ${mavenCommandTime}ms")

            val setupTime = System.currentTimeMillis() - startTime
            log.info("Shared components created in ${setupTime}ms, analyzing ${allProjects.size} projects...")

            val projectStartTime = System.currentTimeMillis()

            // Process projects in parallel with separate analyzer instances
            val inMemoryAnalyses = allProjects.parallelStream().map { mavenProject ->
                try {
                    log.info("Analyzing project: ${mavenProject.artifactId}")

                    // Create separate analyzer instance for each project (thread-safe)
                    val singleAnalyzer = NxProjectAnalyzer(
                        mavenProject,
                        workspaceRoot,
                        sharedLifecycleAnalyzer,
                        mavenCommand
                    )

                    // Get Nx config for project
                    val nxConfig = singleAnalyzer.analyze()

                    nxConfig

                } catch (e: Exception) {
                    log.warn("Failed to analyze project ${mavenProject.artifactId}: ${e.message}")
                    null
                }
            }.collect(java.util.stream.Collectors.toList()).filterNotNull()

            val totalTime = System.currentTimeMillis() - startTime
            val analysisTime = System.currentTimeMillis() - projectStartTime
            log.info("Completed in-memory analysis of ${allProjects.size} projects in ${totalTime}ms (setup: ${setupTime}ms, analysis: ${analysisTime}ms)")

            return inMemoryAnalyses
        } finally {
            gitIgnoreClassifier.close()
        }
    }

    private fun writeProjectAnalysesToFile(inMemoryAnalyses: List<ProjectAnalysis>) {
        val outputPath = if (outputFile.startsWith("/")) {
            File(outputFile)
        } else {
            File(workspaceRoot, outputFile)
        }

        // Ensure parent directory exists
        outputPath.parentFile?.mkdirs()

        // Create JSON structure with both project analyses and createNodesResults
        val rootNode = objectMapper.createObjectNode()
        val projectsNode = objectMapper.createObjectNode()

        // Skip project analyses section - all data is in createNodesResults
        rootNode.set<JsonNode>("projects", projectsNode)

        // Generate createNodesResults for Nx plugin consumption
        val createNodesResults = generateCreateNodesResults(inMemoryAnalyses)
        rootNode.set<JsonNode>("createNodesResults", createNodesResults)


        val createDependenciesResults = generateCreateDependenciesResults(inMemoryAnalyses)
        rootNode.set<JsonNode>("createDependenciesResults", createDependenciesResults)

        // Add metadata
        rootNode.put("totalProjects", inMemoryAnalyses.size)
        rootNode.put("workspaceRoot", workspaceRoot.absolutePath)
        rootNode.put("analysisMethod", "optimized-parallel")
        rootNode.put("analyzedProjects", inMemoryAnalyses.size)

        objectMapper.writerWithDefaultPrettyPrinter().writeValue(outputPath, rootNode)
        log.info("Generated project analyses with ${inMemoryAnalyses.size} projects: ${outputPath.absolutePath}")
    }

    private fun generateCreateDependenciesResults(projectAnalyses: List<ProjectAnalysis>): ArrayNode {
        val result = objectMapper.createArrayNode()
        projectAnalyses.forEach { analysis ->
            analysis.dependencies.forEach { dependency -> result.add(dependency) }
        }
        return result
    }

    private fun generateCreateNodesResults(inMemoryAnalyses: List<ProjectAnalysis>): ArrayNode {
        val createNodesResults = objectMapper.createArrayNode()

        inMemoryAnalyses.forEach { analysis ->
            val resultTuple = objectMapper.createArrayNode()
            resultTuple.add(analysis.pomFile.relativeTo(workspaceRoot).path) // Root path (workspace root)

            // Group projects by root directory (for now, assume all projects are at workspace root)
            val projects = objectMapper.createObjectNode()

            val root = analysis.root
            val project = analysis.project

            val projectsWrapper = objectMapper.createObjectNode()
            projects.set<JsonNode>(root, project)
            projectsWrapper.set<JsonNode>("projects", projects)
            resultTuple.add(projectsWrapper)

            createNodesResults.add(resultTuple)
        }

        return createNodesResults
    }


}
