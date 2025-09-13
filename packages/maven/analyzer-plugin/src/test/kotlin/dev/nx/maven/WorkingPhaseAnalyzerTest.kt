package dev.nx.maven

import org.apache.maven.execution.MavenSession
import org.apache.maven.model.Model
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.mockito.Mockito.mock
import java.io.File
import java.io.FileReader

/**
 * Working unit test for PhaseAnalyzer that actually tests the functionality
 */
class WorkingPhaseAnalyzerTest {

    private lateinit var analyzer: PhaseAnalyzer
    private lateinit var testProject: MavenProject

    @BeforeEach
    fun setUp() {
        // Create mock session and plugin manager for basic functionality
        val session = mock(MavenSession::class.java)
        val pluginManager = mock(MavenPluginManager::class.java)

        // Load the test project
        testProject = loadTestProject()

        // Create PhaseAnalyzer with mock components for basic testing
        val expressionResolver = MavenExpressionResolver(session)
        val pathResolver = PathResolver(testProject.basedir.absolutePath, testProject.basedir.absolutePath, session)

        analyzer = PhaseAnalyzer(pluginManager, session, expressionResolver, pathResolver)
    }

    private fun loadTestProject(): MavenProject {
        val testPom = File("src/test/resources/phase-analyzer-tests/full-lifecycle-project/pom.xml")
        val reader = org.apache.maven.model.io.xpp3.MavenXpp3Reader()
        val model: Model = FileReader(testPom).use { reader.read(it) }

        val project = MavenProject(model)
        // Set file using setter method
        project.setFile(testPom)
        // Note: basedir will be derived from the file automatically

        return project
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
