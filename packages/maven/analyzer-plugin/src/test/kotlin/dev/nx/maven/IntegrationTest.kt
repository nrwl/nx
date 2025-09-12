package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import dev.nx.maven.plugin.PluginBasedAnalyzer
import dev.nx.maven.plugin.PluginExecutionFinder
import dev.nx.maven.MavenExpressionResolver
import java.io.File
import kotlin.test.*

/**
 * Integration tests that verify the analyzer running on real workspace
 * Tests the full end-to-end functionality with actual Maven project structure
 */
class IntegrationTest {
    
    @Mock private lateinit var log: Log
    @Mock private lateinit var session: MavenSession
    @Mock private lateinit var pluginManager: MavenPluginManager
    @Mock private lateinit var lifecycleExecutor: LifecycleExecutor
    @Mock private lateinit var project: MavenProject
    @Mock private lateinit var pluginExecutionFinder: PluginExecutionFinder
    @Mock private lateinit var expressionResolver: MavenExpressionResolver
    
    private lateinit var analyzer: MavenInputOutputAnalyzer
    private val objectMapper = ObjectMapper()
    
    @BeforeEach
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Set up a real project pointing to the current analyzer plugin directory
        // Mock the basedir to point to actual project
        whenever(project.basedir).thenReturn(File("/home/jason/projects/triage/java/maven/packages/maven/analyzer-plugin"))
        
        // Create analyzer with real workspace paths
        val workspaceRoot = "/home/jason/projects/triage/java/maven"
        val pluginAnalyzer = PluginBasedAnalyzer(log, session, pluginManager, pluginExecutionFinder, expressionResolver)
        analyzer = MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, pluginAnalyzer
        )
    }
    
    @Test
    fun `should analyze standard Maven lifecycle phases on real project`() {
        val standardPhases = listOf(
            "validate", "compile", "test-compile", "test", 
            "package", "verify", "install", "deploy"
        )
        
        standardPhases.forEach { phase ->
            assertDoesNotThrow("Phase '$phase' should be analyzable without crashing") {
                val result = analyzer.analyzeCacheability(phase, project)
                
                // Verify that all results have proper structure
                assertNotNull(result.cacheable, "Phase '$phase' should have cacheable decision")
                assertTrue(result.reason.isNotBlank(), "Phase '$phase' should have non-blank reason")
                assertNotNull(result.inputs, "Phase '$phase' should have inputs array")
                assertNotNull(result.outputs, "Phase '$phase' should have outputs array")
                
                // Log the analysis result for debugging
                println("Phase '$phase': cacheable=${result.cacheable}, reason='${result.reason}', inputs=${result.inputs.size()}, outputs=${result.outputs.size()}")
            }
        }
    }
    
    @Test
    fun `should differentiate between side effect and cacheable phases`() {
        val sideEffectPhases = listOf("install", "deploy", "clean")
        val potentiallyCacheablePhases = listOf("validate", "compile", "test-compile", "package")
        
        // Test side effect phases
        sideEffectPhases.forEach { phase ->
            val result = analyzer.analyzeCacheability(phase, project)
            assertFalse(result.cacheable, "Phase '$phase' should not be cacheable due to side effects")
            assertTrue(result.reason.contains("side effects") || result.reason.contains("No analysis available"), 
                "Phase '$phase' should mention side effects or no analysis. Got: ${result.reason}")
            
            println("Side effect phase '$phase': ${result.reason}")
        }
        
        // Test potentially cacheable phases
        potentiallyCacheablePhases.forEach { phase ->
            val result = analyzer.analyzeCacheability(phase, project)
            // These may or may not be cacheable depending on plugin analysis
            // but they should have clear reasoning
            assertTrue(result.reason.isNotBlank(), "Phase '$phase' should have clear reasoning")
            
            println("Potentially cacheable phase '$phase': cacheable=${result.cacheable}, reason='${result.reason}'")
        }
    }
    
    @Test
    fun `should analyze real project structure and detect existing files`() {
        // Test that the analyzer can work with the actual project structure
        val result = analyzer.analyzeCacheability("compile", project)
        
        // The compile phase should return some meaningful analysis
        assertNotNull(result, "Compile analysis should not be null")
        assertTrue(result.reason.isNotBlank(), "Compile analysis should have reasoning")
        
        // Check if we can detect the project structure
        val projectDir = project.basedir
        assertTrue(projectDir.exists(), "Project directory should exist: ${projectDir.absolutePath}")
        assertTrue(File(projectDir, "pom.xml").exists(), "Project should have pom.xml")
        
        // Check for source directories
        val srcMainKotlin = File(projectDir, "src/main/kotlin")
        val srcTestKotlin = File(projectDir, "src/test/kotlin")
        
        println("Project structure analysis:")
        println("  Project dir: ${projectDir.absolutePath}")
        println("  Has pom.xml: ${File(projectDir, "pom.xml").exists()}")
        println("  Has src/main/kotlin: ${srcMainKotlin.exists()}")
        println("  Has src/test/kotlin: ${srcTestKotlin.exists()}")
        println("  Compile analysis: cacheable=${result.cacheable}, reason='${result.reason}'")
        println("  Inputs: ${result.inputs.size()}, Outputs: ${result.outputs.size()}")
    }
    
    @Test
    fun `should maintain consistent behavior across multiple calls`() {
        val testPhases = listOf("compile", "test", "package")
        
        testPhases.forEach { phase ->
            // Multiple calls with same input should return consistent results
            val results = mutableListOf<MavenInputOutputAnalyzer.CacheabilityDecision>()
            
            repeat(3) {
                results.add(analyzer.analyzeCacheability(phase, project))
            }
            
            // All results should be identical
            val first = results.first()
            results.forEach { result ->
                assertEquals(first.cacheable, result.cacheable, 
                    "Cacheability should be consistent for phase '$phase'")
                assertEquals(first.reason, result.reason, 
                    "Reason should be consistent for phase '$phase'")
                assertEquals(first.inputs.size(), result.inputs.size(), 
                    "Input count should be consistent for phase '$phase'")
                assertEquals(first.outputs.size(), result.outputs.size(), 
                    "Output count should be consistent for phase '$phase'")
            }
            
            println("Consistency test for '$phase': ${results.size} calls all returned same result")
        }
    }
    
    @Test
    fun `should handle unknown phases gracefully`() {
        val unknownPhases = listOf("unknown-phase", "custom-phase", "nonexistent-phase")
        
        unknownPhases.forEach { phase ->
            assertDoesNotThrow("Unknown phase '$phase' should not crash analyzer") {
                val result = analyzer.analyzeCacheability(phase, project)
                
                // Unknown phases with no executions are considered cacheable
                assertTrue(result.cacheable, "Unknown phase '$phase' should be cacheable when no executions found")
                assertTrue(result.reason.contains("No plugin executions") || result.reason.contains("Cacheable"), 
                    "Unknown phase '$phase' should indicate no executions. Got: ${result.reason}")
                
                println("Unknown phase '$phase': ${result.reason}")
            }
        }
    }
}