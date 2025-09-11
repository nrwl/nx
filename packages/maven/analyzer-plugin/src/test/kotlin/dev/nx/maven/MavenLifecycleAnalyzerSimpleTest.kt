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
 * Simple tests for MavenLifecycleAnalyzer focusing on testable methods
 * without complex Maven lifecycle execution mocking
 */
class MavenLifecycleAnalyzerSimpleTest {
    
    @Mock private lateinit var log: Log
    @Mock private lateinit var session: MavenSession
    @Mock private lateinit var lifecycleExecutor: LifecycleExecutor
    @Mock private lateinit var pluginManager: MavenPluginManager
    @Mock private lateinit var project: MavenProject
    
    private lateinit var analyzer: MavenLifecycleAnalyzer
    private val objectMapper = ObjectMapper()
    
    @BeforeEach
    fun setUp() {
        MockitoAnnotations.openMocks(this)
        
        // Set up basic project properties
        whenever(project.artifactId).thenReturn("test-project")
        whenever(project.packaging).thenReturn("jar")
        whenever(project.basedir).thenReturn(File("/tmp/test-project"))
        
        analyzer = MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log, pluginManager)
    }
    
    @Test
    fun `should create analyzer instance successfully`() {
        assertNotNull(analyzer, "Analyzer should be created successfully")
    }
    
    @Test
    fun `getCommonPhases should return correct phases for jar packaging`() {
        // Use reflection to access the private method for testing
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val result = method.invoke(analyzer, "jar") as com.fasterxml.jackson.databind.node.ArrayNode
        val phases = result.map { it.asText() }
        
        val expectedPhases = listOf("clean", "validate", "compile", "test", "package", "verify", "install", "deploy")
        expectedPhases.forEach { phase ->
            assertTrue(phases.contains(phase), 
                "JAR packaging should include phase '$phase'. Found: $phases")
        }
        
        println("JAR packaging phases: $phases")
    }
    
    @Test
    fun `getCommonPhases should return correct phases for pom packaging`() {
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val result = method.invoke(analyzer, "pom") as com.fasterxml.jackson.databind.node.ArrayNode
        val phases = result.map { it.asText() }
        
        val expectedPhases = listOf("clean", "validate", "install", "deploy")
        expectedPhases.forEach { phase ->
            assertTrue(phases.contains(phase), 
                "POM packaging should include phase '$phase'. Found: $phases")
        }
        
        // POM should not have compile/test phases
        val unexpectedPhases = listOf("compile", "test", "package")
        unexpectedPhases.forEach { phase ->
            assertFalse(phases.contains(phase), 
                "POM packaging should not include phase '$phase'. Found: $phases")
        }
        
        println("POM packaging phases: $phases")
    }
    
    @Test
    fun `getCommonPhases should return correct phases for war packaging`() {
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val result = method.invoke(analyzer, "war") as com.fasterxml.jackson.databind.node.ArrayNode
        val phases = result.map { it.asText() }
        
        val expectedPhases = listOf("clean", "validate", "compile", "test", "package", "verify", "install", "deploy")
        expectedPhases.forEach { phase ->
            assertTrue(phases.contains(phase), 
                "WAR packaging should include phase '$phase'. Found: $phases")
        }
        
        println("WAR packaging phases: $phases")
    }
    
    @Test
    fun `getCommonPhases should include clean phase for all packaging types`() {
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val packagingTypes = listOf("jar", "war", "ear", "pom", "maven-plugin")
        
        packagingTypes.forEach { packaging ->
            val result = method.invoke(analyzer, packaging) as com.fasterxml.jackson.databind.node.ArrayNode
            val phases = result.map { it.asText() }
            
            assertTrue(phases.contains("clean"), 
                "Packaging '$packaging' should always include clean phase. Found: $phases")
        }
        
        println("✓ All packaging types include clean phase")
    }
    
    @Test
    fun `getCommonPhases should include verify phase for build packaging types`() {
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val buildPackagingTypes = listOf("jar", "war", "ear", "maven-plugin")
        
        buildPackagingTypes.forEach { packaging ->
            val result = method.invoke(analyzer, packaging) as com.fasterxml.jackson.databind.node.ArrayNode
            val phases = result.map { it.asText() }
            
            assertTrue(phases.contains("verify"), 
                "Build packaging '$packaging' should include verify phase. Found: $phases")
        }
        
        println("✓ All build packaging types include verify phase")
    }
    
    @Test
    fun `should handle unknown packaging types gracefully`() {
        val method = analyzer.javaClass.getDeclaredMethod("getCommonPhases", String::class.java)
        method.isAccessible = true
        
        val result = method.invoke(analyzer, "unknown-packaging") as com.fasterxml.jackson.databind.node.ArrayNode
        val phases = result.map { it.asText() }
        
        // Unknown packaging should at least have clean
        assertTrue(phases.contains("clean"), 
            "Unknown packaging should at least include clean phase. Found: $phases")
        
        println("Unknown packaging phases: $phases")
    }
}