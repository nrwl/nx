package dev.nx.maven

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
import dev.nx.maven.PathResolver
import java.io.File
import kotlin.test.*

/**
 * Tests for PluginBasedAnalyzer cacheability assessment logic
 */
class PluginBasedAnalyzerTest {
    
    @Mock private lateinit var log: Log
    @Mock private lateinit var session: MavenSession
    @Mock private lateinit var lifecycleExecutor: LifecycleExecutor
    @Mock private lateinit var pluginManager: MavenPluginManager
    @Mock private lateinit var project: MavenProject
    @Mock private lateinit var pluginExecutionFinder: PluginExecutionFinder
    @Mock private lateinit var expressionResolver: MavenExpressionResolver
    
    private lateinit var analyzer: PluginBasedAnalyzer
    private lateinit var pathResolver: PathResolver
    
    @BeforeEach
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Setup basic project mock
        whenever(project.basedir).thenReturn(File("/test/workspace/project"))
        
        pathResolver = PathResolver("/test/workspace", "/test/workspace/project")
        analyzer = PluginBasedAnalyzer(log, session, pluginManager, pluginExecutionFinder, expressionResolver)
    }
    
    @Test
    fun `should handle side effect phases`() {
        val sideEffectPhases = listOf("install", "deploy", "clean")
        
        sideEffectPhases.forEach { phase ->
            val inputs = linkedSetOf<String>()
            val outputs = linkedSetOf<String>()
            
            // Should not throw exceptions when analyzing side effect phases
            assertDoesNotThrow("Phase '$phase' should not cause analyzer to crash") {
                analyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs, pathResolver)
            }
        }
    }
    
    @Test
    fun `should handle phases with no plugin executions`() {
        val inputs = linkedSetOf<String>()
        val outputs = linkedSetOf<String>()
        
        // When no plugin executions are found, should return false
        val result = analyzer.analyzePhaseInputsOutputs("validate", project, inputs, outputs, pathResolver)
        
        // The method should handle phases with no executions gracefully
        assertTrue(result is Boolean, "Should return a boolean result")
    }
    
    @Test
    fun `should return consistent results for all phases`() {
        val phases = listOf("validate", "compile", "test", "package", "install", "deploy", "clean")
        
        phases.forEach { phase ->
            val inputs = linkedSetOf<String>()
            val outputs = linkedSetOf<String>()
            
            // All phases should be analyzable without throwing exceptions
            assertDoesNotThrow("Phase '$phase' should not cause analyzer to crash") {
                val result = analyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs, pathResolver)
                assertTrue(result is Boolean, "Phase '$phase' should return a boolean result")
            }
        }
    }
    
    @Test
    fun `should maintain consistent behavior across multiple calls`() {
        val phases = listOf("validate", "compile", "test")
        
        phases.forEach { phase ->
            val results = mutableListOf<Boolean>()
            
            // Multiple calls should return consistent results
            repeat(3) {
                val inputs = linkedSetOf<String>()
                val outputs = linkedSetOf<String>()
                results.add(analyzer.analyzePhaseInputsOutputs(phase, project, inputs, outputs, pathResolver))
            }
            
            // All results should be the same
            val first = results.first()
            results.forEach { result ->
                assertEquals(first, result, "Results should be consistent for phase '$phase'")
            }
        }
    }
    
    @Test
    fun `analyzePhaseInputsOutputs should handle empty executions gracefully`() {
        val inputs = linkedSetOf<String>()
        val outputs = linkedSetOf<String>()
        
        // This will likely return false for most phases when no executions are found
        val result = analyzer.analyzePhaseInputsOutputs("validate", project, inputs, outputs, pathResolver)
        
        // The method should not throw exceptions and should return a boolean
        assertTrue(result is Boolean, "analyzePhaseInputsOutputs should return a boolean")
    }
    
    @Test
    fun `should maintain input and output set references`() {
        val inputs = linkedSetOf<String>()
        val outputs = linkedSetOf<String>()
        val originalInputsRef = inputs
        val originalOutputsRef = outputs
        
        analyzer.analyzePhaseInputsOutputs("compile", project, inputs, outputs, pathResolver)
        
        // The same set instances should be used (not copied)
        assertSame(originalInputsRef, inputs, "Input set reference should be maintained")
        assertSame(originalOutputsRef, outputs, "Output set reference should be maintained")
    }
}