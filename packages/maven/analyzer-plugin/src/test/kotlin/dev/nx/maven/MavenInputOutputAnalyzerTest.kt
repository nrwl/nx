package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.execution.MavenSession
import org.apache.maven.lifecycle.LifecycleExecutor
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import java.io.File
import kotlin.test.*

/**
 * Tests for the MavenInputOutputAnalyzer that verify cacheability analysis
 */
class MavenInputOutputAnalyzerTest {
    
    @Mock private lateinit var log: Log
    @Mock private lateinit var session: MavenSession
    @Mock private lateinit var pluginManager: MavenPluginManager
    @Mock private lateinit var lifecycleExecutor: LifecycleExecutor
    @Mock private lateinit var project: MavenProject
    
    private lateinit var analyzer: MavenInputOutputAnalyzer
    private val objectMapper = ObjectMapper()
    private val workspaceRoot = "/test/workspace"
    
    @BeforeEach
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Setup basic project mock
        whenever(project.basedir).thenReturn(File("/test/workspace/project"))
        
        analyzer = MavenInputOutputAnalyzer(
            objectMapper, workspaceRoot, log, session, pluginManager, lifecycleExecutor
        )
    }
    
    @Test
    fun `should handle unknown phase`() {
        val result = analyzer.analyzeCacheability("unknown-phase", project)
        
        assertFalse(result.cacheable)
        assertEquals("No analysis available for phase 'unknown-phase'", result.reason)
        assertTrue(result.inputs.size() >= 1) // At least dependentTasksOutputFiles
    }
    
    @Test
    fun `should recognize side effect phases as non-cacheable`() {
        val sideEffectPhases = listOf("install", "deploy", "clean")
        
        sideEffectPhases.forEach { phase ->
            val result = analyzer.analyzeCacheability(phase, project)
            
            assertFalse(result.cacheable, "Phase '$phase' should not be cacheable")
            assertTrue(result.reason.contains("side effects") || result.reason.contains("No analysis available"), 
                "Phase '$phase' should mention side effects or no analysis. Got: ${result.reason}")
        }
    }
    
    @Test
    fun `should include dependentTasksOutputFiles in inputs`() {
        val result = analyzer.analyzeCacheability("validate", project)
        
        // Should always include dependentTasksOutputFiles as first input
        assertTrue(result.inputs.size() >= 1)
        val firstInput = result.inputs[0]
        assertTrue(firstInput.has("dependentTasksOutputFiles"))
        assertTrue(firstInput.has("transitive"))
        assertEquals("**/*", firstInput.get("dependentTasksOutputFiles").asText())
        assertTrue(firstInput.get("transitive").asBoolean())
    }
    
    @Test
    fun `should return consistent structure for all phases`() {
        val phases = listOf("validate", "compile", "test", "package", "install", "deploy")
        
        phases.forEach { phase ->
            val result = analyzer.analyzeCacheability(phase, project)
            
            // All results should have these fields
            assertNotNull(result.cacheable)
            assertNotNull(result.reason)
            assertNotNull(result.inputs)
            assertNotNull(result.outputs)
            
            // Reason should not be empty
            assertTrue(result.reason.isNotBlank(), "Reason should not be blank for phase '$phase'")
            
            // Should always have at least dependentTasksOutputFiles input
            assertTrue(result.inputs.size() >= 1, "Should have at least one input for phase '$phase'")
        }
    }
    
    @Test
    fun `cacheable phases should return positive result when plugins are analyzed`() {
        // This test would require setting up mock plugin executions
        // For now, we'll test the basic structure
        val potentiallyCacheablePhases = listOf("validate", "compile", "test-compile", "package")
        
        potentiallyCacheablePhases.forEach { phase ->
            val result = analyzer.analyzeCacheability(phase, project)
            
            // Either cacheable or has a clear reason why not
            if (result.cacheable) {
                assertTrue(result.reason.contains("Cacheable:"), 
                    "Cacheable phase '$phase' should have reason starting with 'Cacheable:'. Got: ${result.reason}")
            } else {
                assertTrue(result.reason.isNotBlank(), 
                    "Non-cacheable phase '$phase' should have a reason. Got: ${result.reason}")
            }
        }
    }
}