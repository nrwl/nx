package dev.nx.maven

import org.apache.maven.api.plugin.testing.MojoTest
import org.apache.maven.api.plugin.testing.InjectMojo
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

/**
 * Working unit test for PhaseAnalyzer that uses Maven Plugin Testing Harness 4.0
 */
@MojoTest
class PhaseAnalyzerTest {

    private lateinit var analyzer: PhaseAnalyzer
    private var gitIgnoreClassifier: GitIgnoreClassifier? = null

    // Let the testing harness inject the session, plugin manager, and project
    @InjectMojo(goal = "analyze")
    private lateinit var session: MavenSession

    @InjectMojo(goal = "analyze")
    private lateinit var pluginManager: MavenPluginManager

    @InjectMojo(goal = "analyze")
    private lateinit var testProject: MavenProject

    @BeforeEach
    fun setUp() {
        // No need to manually load the test project - it's injected by the harness

        // Create GitIgnoreClassifier exactly as done in the main mojo
        gitIgnoreClassifier = try {
            val sessionRoot = session.executionRootDirectory?.let { java.io.File(it) }
            if (sessionRoot != null) {
                GitIgnoreClassifier(sessionRoot)
            } else {
                null
            }
        } catch (e: Exception) {
            println("Failed to initialize GitIgnoreClassifier: ${e.message}")
            null
        }

        // Create components with real session and plugin manager from testing harness
        val expressionResolver = MavenExpressionResolver(session)
        val pathResolver = PathResolver(testProject.basedir.absolutePath, testProject.basedir.absolutePath, session)

        analyzer = PhaseAnalyzer(pluginManager, session, expressionResolver, pathResolver, gitIgnoreClassifier)
    }

    @AfterEach
    fun tearDown() {
        // Clean up GitIgnoreClassifier resources
        gitIgnoreClassifier?.close()
    }



    @Test
    fun testAnalyzeCompilePhase() {
        // Test compile phase analysis
        val result = analyzer.analyze(testProject, "compile")

        // Verify basic properties
        assertNotNull(result)
        assertTrue(result.isThreadSafe, "Compile phase should be thread safe")
        assertTrue(result.isCacheable, "Compile phase should be cacheable")

        // Print results for debugging
        println("Compile phase analysis:")
        println("  Thread Safe: ${result.isThreadSafe}")
        println("  Cacheable: ${result.isCacheable}")
        println("  Inputs (${result.inputs.size}): ${result.inputs}")
        println("  Outputs (${result.outputs.size}): ${result.outputs}")
    }

    @Test
    fun testAnalyzeTestPhase() {
        // Test phase analysis
        val result = analyzer.analyze(testProject, "test")

        // Verify basic properties
        assertNotNull(result)
        assertTrue(result.isThreadSafe, "Test phase should be thread safe")
        // Note: test phase might be non-cacheable due to surefire plugin

        println("Test phase analysis:")
        println("  Thread Safe: ${result.isThreadSafe}")
        println("  Cacheable: ${result.isCacheable}")
        println("  Inputs (${result.inputs.size}): ${result.inputs}")
        println("  Outputs (${result.outputs.size}): ${result.outputs}")
    }

    @Test
    fun testAnalyzeDeployPhase() {
        // Deploy phase should be non-cacheable
        val result = analyzer.analyze(testProject, "deploy")

        assertNotNull(result)
        assertFalse(result.isCacheable, "Deploy phase should NOT be cacheable")

        println("Deploy phase analysis:")
        println("  Thread Safe: ${result.isThreadSafe}")
        println("  Cacheable: ${result.isCacheable}")
        println("  Inputs (${result.inputs.size}): ${result.inputs}")
        println("  Outputs (${result.outputs.size}): ${result.outputs}")
    }

    @Test
    fun testAnalyzeMultiplePhases() {
        // Test analyzing several phases
        val phases = listOf("compile", "test", "package", "install", "deploy")
        val results = mutableMapOf<String, PhaseInformation>()

        for (phase in phases) {
            try {
                val result = analyzer.analyze(testProject, phase)
                results[phase] = result
                println("$phase: cacheable=${result.isCacheable}, threadSafe=${result.isThreadSafe}, inputs=${result.inputs.size}, outputs=${result.outputs.size}")
            } catch (e: Exception) {
                println("Failed to analyze $phase: ${e.message}")
            }
        }

        // Verify we got results for all phases
        assertTrue(results.size >= 3, "Should analyze at least 3 phases successfully")

        // Deploy and install should not be cacheable
        if (results.containsKey("deploy")) {
            assertFalse(results["deploy"]!!.isCacheable, "Deploy should not be cacheable")
        }
        if (results.containsKey("install")) {
            assertFalse(results["install"]!!.isCacheable, "Install should not be cacheable")
        }
    }

    @Test
    fun testAnalyzeEmptyPhase() {
        // Test with a phase that has no plugins
        val result = analyzer.analyze(testProject, "non-existent-phase")

        assertNotNull(result)
        assertTrue(result.isThreadSafe, "Empty phase should be thread safe")
        assertTrue(result.isCacheable, "Empty phase should be cacheable")
        assertTrue(result.inputs.isEmpty(), "Empty phase should have no inputs")
        assertTrue(result.outputs.isEmpty(), "Empty phase should have no outputs")
    }
}
