package dev.nx.maven

import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.maven.artifact.DefaultArtifact
import org.apache.maven.model.*
import org.apache.maven.plugin.logging.Log
import org.apache.maven.project.MavenProject
import org.apache.maven.execution.MavenSession
import org.apache.maven.plugin.MavenPluginManager
import org.apache.maven.lifecycle.LifecycleExecutor
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.mockito.kotlin.*
import java.io.File
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MavenInputOutputAnalyzerTest {
    
    private lateinit var analyzer: MavenInputOutputAnalyzer
    private lateinit var mockLog: Log
    private lateinit var mockProject: MavenProject
    private lateinit var mockBuild: Build
    private lateinit var mockSession: MavenSession
    private lateinit var mockPluginManager: MavenPluginManager
    private lateinit var mockLifecycleExecutor: LifecycleExecutor
    private lateinit var objectMapper: ObjectMapper
    
    @TempDir
    lateinit var tempDir: Path
    
    @BeforeEach
    fun setup() {
        objectMapper = ObjectMapper()
        mockLog = mock<Log>()
        mockProject = mock<MavenProject>()
        mockBuild = mock<Build>()
        mockSession = mock<MavenSession>()
        mockPluginManager = mock<MavenPluginManager>()
        mockLifecycleExecutor = mock<LifecycleExecutor>()
        
        // Setup default project mocks
        whenever(mockProject.build).thenReturn(mockBuild)
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf())
        whenever(mockProject.compileSourceRoots).thenReturn(mutableListOf())
        whenever(mockProject.testCompileSourceRoots).thenReturn(mutableListOf())
        whenever(mockProject.compileArtifacts).thenReturn(mutableListOf())
        whenever(mockProject.testArtifacts).thenReturn(mutableListOf())
        
        // Setup build defaults
        whenever(mockBuild.resources).thenReturn(mutableListOf())
        whenever(mockBuild.testResources).thenReturn(mutableListOf())
        whenever(mockBuild.directory).thenReturn(tempDir.resolve("target").toString())
        whenever(mockBuild.outputDirectory).thenReturn(tempDir.resolve("target/classes").toString())
        whenever(mockBuild.testOutputDirectory).thenReturn(tempDir.resolve("target/test-classes").toString())
        whenever(mockBuild.finalName).thenReturn("test-project-1.0.0")
        
        // Setup project basedir for path resolution
        val projectDir = tempDir.toFile()
        whenever(mockProject.basedir).thenReturn(projectDir)
        whenever(mockProject.artifactId).thenReturn("test-project")
        whenever(mockProject.groupId).thenReturn("com.example")
        whenever(mockProject.version).thenReturn("1.0.0")
        
        analyzer = MavenInputOutputAnalyzer(objectMapper, tempDir.toString(), mockLog, mockSession, mockPluginManager, mockLifecycleExecutor)
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for install plugin`() {
        // Given
        val installPlugin = createPlugin("maven-install-plugin", listOf(createExecution("install", "install")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(installPlugin))
        
        // When
        val result = analyzer.analyzeCacheability("install", mockProject)
        
        // Then
        assertFalse(result.cacheable)
        assertEquals("Plugin descriptor unavailable for maven-install-plugin", result.reason)
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for deploy plugin`() {
        // Given
        val deployPlugin = createPlugin("maven-deploy-plugin", listOf(createExecution("deploy", "deploy")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(deployPlugin))
        
        // When
        val result = analyzer.analyzeCacheability("deploy", mockProject)
        
        // Then
        assertFalse(result.cacheable)
        assertEquals("Plugin descriptor unavailable for maven-deploy-plugin", result.reason)
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for clean plugin`() {
        // Given
        val cleanPlugin = createPlugin("maven-clean-plugin", listOf(createExecution("clean", "clean")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(cleanPlugin))
        
        // When
        val result = analyzer.analyzeCacheability("clean", mockProject)
        
        // Then
        assertFalse(result.cacheable)
        assertEquals("Plugin descriptor unavailable for maven-clean-plugin", result.reason)
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for compiler plugin`() {
        // Given
        val compilerPlugin = createPlugin("maven-compiler-plugin", listOf(createExecution("compile", "compile")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(compilerPlugin))
        // No source roots or resources - only pom.xml will be included
        
        // When
        val result = analyzer.analyzeCacheability("compile", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-compiler-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    @Test
    fun `should detect plugin descriptor unavailable when no mojo descriptors available`() {
        // Given
        val compilerPlugin = createPlugin("maven-compiler-plugin", listOf(createExecution("compile", "compile")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(compilerPlugin))
        
        // When
        val result = analyzer.analyzeCacheability("compile", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-compiler-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for test-compile phase`() {
        // Given
        val compilerPlugin = createPlugin("maven-compiler-plugin", listOf(createExecution("test-compile", "testCompile")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(compilerPlugin))
        
        // Create directories
        val testSrcDir = tempDir.resolve("src/test/java").toFile()
        testSrcDir.mkdirs()
        val testResourceDir = tempDir.resolve("src/test/resources").toFile()
        testResourceDir.mkdirs()
        val mainClassesDir = tempDir.resolve("target/classes").toFile()
        mainClassesDir.mkdirs()
        
        whenever(mockProject.testCompileSourceRoots).thenReturn(mutableListOf(testSrcDir.absolutePath))
        whenever(mockBuild.testResources).thenReturn(mutableListOf(createResource(testResourceDir.absolutePath)))
        
        // When
        val result = analyzer.analyzeCacheability("test-compile", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-compiler-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for test phase`() {
        // Given
        val surefirePlugin = createPlugin("maven-surefire-plugin", listOf(createExecution("test", "test")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(surefirePlugin))
        
        // Create directories
        val testClassesDir = tempDir.resolve("target/test-classes").toFile()
        testClassesDir.mkdirs()
        val mainClassesDir = tempDir.resolve("target/classes").toFile()
        mainClassesDir.mkdirs()
        
        // Add test artifacts
        val testArtifact = DefaultArtifact("junit", "junit", "4.13.2", "test", "jar", "", null)
        whenever(mockProject.testArtifacts).thenReturn(mutableListOf<org.apache.maven.artifact.Artifact>(testArtifact))
        
        // When
        val result = analyzer.analyzeCacheability("test", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-surefire-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for package phase`() {
        // Given
        val jarPlugin = createPlugin("maven-jar-plugin", listOf(createExecution("package", "jar")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(jarPlugin))
        
        // Create directories
        val classesDir = tempDir.resolve("target/classes").toFile()
        classesDir.mkdirs()
        val resourceDir = tempDir.resolve("src/main/resources").toFile()
        resourceDir.mkdirs()
        
        whenever(mockBuild.resources).thenReturn(mutableListOf(createResource(resourceDir.absolutePath)))
        
        // When
        val result = analyzer.analyzeCacheability("package", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-jar-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    @Test
    fun `should detect no executions for compiler plugin with no explicit phase`() {
        // Given - plugin with no explicit phase but should bind to compile by default
        val compilerPlugin = createPlugin("maven-compiler-plugin", emptyList())
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(compilerPlugin))
        
        // Create source directory
        val srcDir = tempDir.resolve("src/main/java").toFile()
        srcDir.mkdirs()
        whenever(mockProject.compileSourceRoots).thenReturn(mutableListOf(srcDir.absolutePath))
        
        // When
        val result = analyzer.analyzeCacheability("compile", mockProject)
        
        // Then  
        assertFalse(result.cacheable) // Plugin has no executions for this phase, still tries to load descriptor
        assertEquals("Plugin descriptor unavailable for maven-compiler-plugin", result.reason)
    }
    
    @Test
    fun `should detect no executions for surefire plugin with no explicit phase`() {
        // Given - plugin with no explicit phase but should bind to test by default
        val surefirePlugin = createPlugin("maven-surefire-plugin", emptyList())
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(surefirePlugin))
        
        // Create test classes directory
        val testClassesDir = tempDir.resolve("target/test-classes").toFile()
        testClassesDir.mkdirs()
        val mainClassesDir = tempDir.resolve("target/classes").toFile()
        mainClassesDir.mkdirs()
        
        // When
        val result = analyzer.analyzeCacheability("test", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin has no executions for this phase, still tries to load descriptor  
        assertEquals("Plugin descriptor unavailable for maven-surefire-plugin", result.reason)
    }
    
    @Test
    fun `should return no executions for validate phase with no plugins`() {
        // Given - no plugins configured for validate phase
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf())
        
        // When
        val result = analyzer.analyzeCacheability("validate", mockProject)
        
        // Then
        assertFalse(result.cacheable) // No plugin executions found
        assertEquals("No plugin executions found for phase 'validate'", result.reason)
        assertEquals(1, result.inputs.size()) // just pom.xml
    }
    
    @Test
    fun `should return no executions when no plugins and unknown phase`() {
        // Given - no plugins and unknown phase 
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf())
        
        // When
        val result = analyzer.analyzeCacheability("unknown-phase", mockProject)
        
        // Then
        assertFalse(result.cacheable) // No plugin executions found
        assertEquals("No plugin executions found for phase 'unknown-phase'", result.reason)
        assertEquals(1, result.inputs.size()) // just pom.xml
    }
    
    @Test
    fun `should detect plugin descriptor unavailable for dependency fingerprint test`() {
        // Given
        val compilerPlugin = createPlugin("maven-compiler-plugin", listOf(createExecution("compile", "compile")))
        whenever(mockProject.buildPlugins).thenReturn(mutableListOf(compilerPlugin))
        
        val srcDir = tempDir.resolve("src/main/java").toFile()
        srcDir.mkdirs()
        whenever(mockProject.compileSourceRoots).thenReturn(mutableListOf(srcDir.absolutePath))
        
        val artifact1 = DefaultArtifact("com.example", "dep1", "1.0.0", "compile", "jar", "", null)
        val artifact2 = DefaultArtifact("com.example", "dep2", "2.0.0", "compile", "jar", "", null)
        whenever(mockProject.compileArtifacts).thenReturn(mutableListOf<org.apache.maven.artifact.Artifact>(artifact1, artifact2))
        
        // When
        val result = analyzer.analyzeCacheability("compile", mockProject)
        
        // Then
        assertFalse(result.cacheable) // Plugin descriptor unavailable
        assertEquals("Plugin descriptor unavailable for maven-compiler-plugin", result.reason)
        assertEquals(1, result.inputs.size()) // Only pom.xml
    }
    
    // Helper methods
    private fun createPlugin(artifactId: String, executions: List<PluginExecution>): Plugin {
        val plugin = Plugin()
        plugin.artifactId = artifactId
        plugin.groupId = "org.apache.maven.plugins"
        plugin.executions = executions
        return plugin
    }
    
    private fun createExecution(phase: String, vararg goals: String): PluginExecution {
        val execution = PluginExecution()
        execution.phase = phase
        execution.goals = goals.toMutableList()
        return execution
    }
    
    private fun createResource(directory: String): Resource {
        val resource = Resource()
        resource.directory = directory
        return resource
    }
    
    private fun assertNotNull(value: Any?) {
        if (value == null) {
            throw AssertionError("Expected non-null value")
        }
    }
}