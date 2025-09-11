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
import java.io.File
import kotlin.test.*

/**
 * Tests for MavenLifecycleAnalyzer using minimal mocking approach
 * Tests phase discovery, goal discovery, and plugin analysis
 */
class MavenLifecycleAnalyzerTest {
    
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
        
        // Set up project to point to real maven-cli project for testing
        val cliProjectDir = File("/home/jason/projects/triage/java/maven/impl/maven-cli")
        whenever(project.basedir).thenReturn(cliProjectDir)
        whenever(project.artifactId).thenReturn("maven-cli")
        whenever(project.packaging).thenReturn("jar")
        
        analyzer = MavenLifecycleAnalyzer(lifecycleExecutor, session, objectMapper, log, pluginManager)
    }
    
    @Test
    fun `should extract lifecycle data without errors`() {
        assertDoesNotThrow("Lifecycle data extraction should not throw") {
            val result = analyzer.extractLifecycleData(project)
            
            // Verify basic structure
            assertNotNull(result, "Lifecycle data should not be null")
            assertTrue(result.has("phases"), "Should have phases")
            assertTrue(result.has("goals"), "Should have goals")
            assertTrue(result.has("plugins"), "Should have plugins")
            assertTrue(result.has("commonPhases"), "Should have common phases")
        }
    }
    
    @Test
    fun `should include essential phases`() {
        val result = analyzer.extractLifecycleData(project)
        val phases = result.get("phases")
        
        assertNotNull(phases, "Phases should not be null")
        assertTrue(phases.isArray, "Phases should be an array")
        
        val phaseList = phases.map { it.asText() }
        val essentialPhases = listOf("verify", "integration-test", "pre-integration-test", "post-integration-test")
        
        essentialPhases.forEach { phase ->
            assertTrue(phaseList.contains(phase), 
                "Essential phase '$phase' should be included. Found phases: $phaseList")
        }
        
        println("Discovered phases: $phaseList")
        println("Essential phases verified: $essentialPhases")
    }
    
    @Test
    fun `should include standard Maven phases for jar packaging`() {
        val result = analyzer.extractLifecycleData(project)
        val commonPhases = result.get("commonPhases")
        
        assertNotNull(commonPhases, "Common phases should not be null")
        assertTrue(commonPhases.isArray, "Common phases should be an array")
        
        val commonPhaseList = commonPhases.map { it.asText() }
        val expectedPhases = listOf("clean", "validate", "compile", "test", "package", "verify", "install", "deploy")
        
        expectedPhases.forEach { phase ->
            assertTrue(commonPhaseList.contains(phase), 
                "Standard phase '$phase' should be included for jar packaging. Found: $commonPhaseList")
        }
        
        println("Common phases for jar packaging: $commonPhaseList")
    }
    
    @Test
    fun `should discover plugins and goals`() {
        val result = analyzer.extractLifecycleData(project)
        
        val plugins = result.get("plugins")
        assertNotNull(plugins, "Plugins should not be null")
        assertTrue(plugins.isArray, "Plugins should be an array")
        assertTrue(plugins.size() > 0, "Should discover at least some plugins")
        
        val goals = result.get("goals")
        assertNotNull(goals, "Goals should not be null")
        assertTrue(goals.isArray, "Goals should be an array")
        assertTrue(goals.size() > 0, "Should discover at least some goals")
        
        // Check plugin structure
        val firstPlugin = plugins.get(0)
        assertTrue(firstPlugin.has("groupId"), "Plugin should have groupId")
        assertTrue(firstPlugin.has("artifactId"), "Plugin should have artifactId")
        assertTrue(firstPlugin.has("executions"), "Plugin should have executions")
        
        // Check goal structure
        val firstGoal = goals.get(0)
        assertTrue(firstGoal.has("groupId"), "Goal should have groupId")
        assertTrue(firstGoal.has("plugin"), "Goal should have plugin")
        assertTrue(firstGoal.has("goal"), "Goal should have goal")
        assertTrue(firstGoal.has("phase"), "Goal should have phase")
        assertTrue(firstGoal.has("classification"), "Goal should have classification")
        
        println("Discovered ${plugins.size()} plugins and ${goals.size()} goals")
    }
    
    @Test
    fun `should handle different packaging types`() {
        // Test with pom packaging
        whenever(project.packaging).thenReturn("pom")
        
        val pomResult = analyzer.extractLifecycleData(project)
        val pomCommonPhases = pomResult.get("commonPhases").map { it.asText() }
        
        // POM projects should have fewer phases
        assertTrue(pomCommonPhases.contains("clean"), "POM should have clean phase")
        assertTrue(pomCommonPhases.contains("validate"), "POM should have validate phase")
        assertTrue(pomCommonPhases.contains("install"), "POM should have install phase")
        assertTrue(pomCommonPhases.contains("deploy"), "POM should have deploy phase")
        
        // Test with war packaging
        whenever(project.packaging).thenReturn("war")
        
        val warResult = analyzer.extractLifecycleData(project)
        val warCommonPhases = warResult.get("commonPhases").map { it.asText() }
        
        // WAR projects should have full lifecycle
        val expectedWarPhases = listOf("clean", "validate", "compile", "test", "package", "verify", "install", "deploy")
        expectedWarPhases.forEach { phase ->
            assertTrue(warCommonPhases.contains(phase), 
                "WAR packaging should include phase '$phase'. Found: $warCommonPhases")
        }
        
        println("POM packaging phases: $pomCommonPhases")
        println("WAR packaging phases: $warCommonPhases")
    }
    
    @Test
    fun `should maintain consistency across multiple calls`() {
        val results = mutableListOf<com.fasterxml.jackson.databind.JsonNode>()
        
        repeat(3) {
            results.add(analyzer.extractLifecycleData(project))
        }
        
        // All results should have same structure
        val first = results.first()
        results.forEach { result ->
            assertEquals(first.get("phases").size(), result.get("phases").size(),
                "Phase count should be consistent")
            assertEquals(first.get("commonPhases").size(), result.get("commonPhases").size(),
                "Common phase count should be consistent")
            assertTrue(first.get("plugins").size() <= result.get("plugins").size(),
                "Plugin count should be consistent or grow (due to discovery)")
        }
        
        println("Consistency test: ${results.size} calls returned consistent results")
    }
    
    @Test
    fun `should discover verify phase in maven-cli project`() {
        // This is the specific test for the issue we found
        val result = analyzer.extractLifecycleData(project)
        val phases = result.get("phases").map { it.asText() }
        
        assertTrue(phases.contains("verify"), 
            "maven-cli project should have verify phase. Found phases: $phases")
        
        // Also check that verify appears in common phases for jar packaging
        val commonPhases = result.get("commonPhases").map { it.asText() }
        assertTrue(commonPhases.contains("verify"),
            "verify should be in common phases for jar packaging. Found: $commonPhases")
        
        println("✓ Verify phase successfully discovered in maven-cli project")
        println("All phases: $phases")
        println("Common phases: $commonPhases")
    }
}