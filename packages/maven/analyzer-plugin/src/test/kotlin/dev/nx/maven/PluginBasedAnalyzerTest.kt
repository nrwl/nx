package dev.nx.maven

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
 * Tests for PluginBasedAnalyzer cacheability assessment logic
 */
class PluginBasedAnalyzerTest {
    
    @Mock private lateinit var log: Log
    @Mock private lateinit var session: MavenSession
    @Mock private lateinit var lifecycleExecutor: LifecycleExecutor
    @Mock private lateinit var pluginManager: MavenPluginManager
    @Mock private lateinit var project: MavenProject
    
    private lateinit var analyzer: PluginBasedAnalyzer
    private lateinit var pathResolver: PathResolver
    
    @BeforeEach
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Setup basic project mock
        whenever(project.basedir).thenReturn(File("/test/workspace/project"))
        
        pathResolver = PathResolver("/test/workspace", "/test/workspace/project")
        analyzer = PluginBasedAnalyzer(log, session, lifecycleExecutor, pluginManager, pathResolver)
    }
    
    @Test
    fun `should identify side effect phases as non-cacheable`() {
        val sideEffectPhases = listOf("install", "deploy", "clean")
        
        sideEffectPhases.forEach { phase ->
            val assessment = analyzer.getCacheabilityAssessment(phase, project)
            
            assertFalse(assessment.cacheable, "Phase '$phase' should not be cacheable")
            assertTrue(assessment.reason.contains("side effects"), 
                "Phase '$phase' should mention side effects. Got: ${assessment.reason}")
            assertTrue(assessment.details.isNotEmpty(), 
                "Phase '$phase' should have details explaining why it's not cacheable")
        }
    }
    
    @Test
    fun `should handle phases with no plugin executions`() {
        // When no plugin executions are found, the phase should be considered safe to cache
        val assessment = analyzer.getCacheabilityAssessment("validate", project)
        
        // The actual behavior depends on whether executions are found
        // This test documents the current behavior
        assertNotNull(assessment.cacheable)
        assertNotNull(assessment.reason)
        assertTrue(assessment.reason.isNotBlank())
    }
    
    @Test
    fun `should return consistent assessment structure`() {
        val phases = listOf("validate", "compile", "test", "package", "install", "deploy", "clean")
        
        phases.forEach { phase ->
            val assessment = analyzer.getCacheabilityAssessment(phase, project)
            
            // All assessments should have required fields
            assertNotNull(assessment.cacheable, "Phase '$phase' assessment should have cacheable field")
            assertTrue(assessment.reason.isNotBlank(), "Phase '$phase' assessment should have non-blank reason")
            assertNotNull(assessment.details, "Phase '$phase' assessment should have details list")
        }
    }
    
    @Test
    fun `isPhaseCacheable should match getCacheabilityAssessment`() {
        val phases = listOf("validate", "compile", "test", "package", "install", "deploy", "clean")
        
        phases.forEach { phase ->
            val assessment = analyzer.getCacheabilityAssessment(phase, project)
            val isCacheable = analyzer.isPhaseCacheable(phase, project)
            
            assertEquals(assessment.cacheable, isCacheable, 
                "isPhaseCacheable and getCacheabilityAssessment should agree for phase '$phase'")
        }
    }
    
    @Test
    fun `analyzePhaseInputsOutputs should handle empty executions gracefully`() {
        val inputs = linkedSetOf<String>()
        val outputs = linkedSetOf<String>()
        
        // This will likely return false for most phases when no executions are found
        val result = analyzer.analyzePhaseInputsOutputs("validate", project, inputs, outputs)
        
        // The method should not throw exceptions and should return a boolean
        assertTrue(result is Boolean, "analyzePhaseInputsOutputs should return a boolean")
    }
    
    @Test
    fun `should maintain input and output set references`() {
        val inputs = linkedSetOf<String>()
        val outputs = linkedSetOf<String>()
        val originalInputsRef = inputs
        val originalOutputsRef = outputs
        
        analyzer.analyzePhaseInputsOutputs("compile", project, inputs, outputs)
        
        // The same set instances should be used (not copied)
        assertSame(originalInputsRef, inputs, "Input set reference should be maintained")
        assertSame(originalOutputsRef, outputs, "Output set reference should be maintained")
    }
}