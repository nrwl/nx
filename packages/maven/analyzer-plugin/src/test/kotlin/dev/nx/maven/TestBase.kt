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
import org.junit.jupiter.api.io.TempDir
import org.mockito.kotlin.*
import java.io.File
import java.nio.file.Path

/**
 * Base class for Maven analyzer tests with simplified setup
 */
abstract class TestBase {
    
    protected lateinit var analyzer: MavenInputOutputAnalyzer
    protected lateinit var testProject: TestProject
    
    @TempDir
    lateinit var tempDir: Path
    
    @BeforeEach
    fun setupBase() {
        testProject = TestProject(tempDir)
        analyzer = MavenInputOutputAnalyzer(
            ObjectMapper(),
            tempDir.toString(),
            testProject.mockLog,
            testProject.mockSession,
            testProject.mockPluginManager,
            testProject.mockLifecycleExecutor
        )
    }
    
    /**
     * Test helper that wraps all Maven mocks and provides simple methods
     */
    class TestProject(private val tempDir: Path) {
        val mockLog: Log = mock()
        val mockProject: MavenProject = mock()
        val mockBuild: Build = mock()
        val mockSession: MavenSession = mock()
        val mockPluginManager: MavenPluginManager = mock()
        val mockLifecycleExecutor: LifecycleExecutor = mock()
        
        init {
            setupBasicMocks()
        }
        
        private fun setupBasicMocks() {
            // Basic project setup
            whenever(mockProject.build).thenReturn(mockBuild)
            whenever(mockProject.basedir).thenReturn(tempDir.toFile())
            whenever(mockProject.artifactId).thenReturn("test-project")
            whenever(mockProject.groupId).thenReturn("com.example")
            whenever(mockProject.version).thenReturn("1.0.0")
            
            // Build directories
            whenever(mockBuild.directory).thenReturn(tempDir.resolve("target").toString())
            whenever(mockBuild.outputDirectory).thenReturn(tempDir.resolve("target/classes").toString())
            whenever(mockBuild.testOutputDirectory).thenReturn(tempDir.resolve("target/test-classes").toString())
            whenever(mockBuild.finalName).thenReturn("test-project-1.0.0")
            
            // Empty defaults
            whenever(mockProject.buildPlugins).thenReturn(mutableListOf())
            whenever(mockProject.compileSourceRoots).thenReturn(mutableListOf())
            whenever(mockProject.testCompileSourceRoots).thenReturn(mutableListOf())
            whenever(mockProject.compileArtifacts).thenReturn(mutableListOf())
            whenever(mockProject.testArtifacts).thenReturn(mutableListOf())
            whenever(mockBuild.resources).thenReturn(mutableListOf())
            whenever(mockBuild.testResources).thenReturn(mutableListOf())
        }
        
        fun withPlugin(name: String, phase: String, vararg goals: String): TestProject {
            val plugin = createPlugin(name, phase, *goals)
            val currentPlugins = mockProject.buildPlugins
            currentPlugins.add(plugin)
            return this
        }
        
        fun withMainSources(): TestProject {
            val srcDir = tempDir.resolve("src/main/java").toFile()
            srcDir.mkdirs()
            whenever(mockProject.compileSourceRoots).thenReturn(mutableListOf(srcDir.absolutePath))
            return this
        }
        
        fun withTestSources(): TestProject {
            val testSrcDir = tempDir.resolve("src/test/java").toFile()
            testSrcDir.mkdirs()
            whenever(mockProject.testCompileSourceRoots).thenReturn(mutableListOf(testSrcDir.absolutePath))
            return this
        }
        
        fun withMainResources(): TestProject {
            val resourceDir = tempDir.resolve("src/main/resources").toFile()
            resourceDir.mkdirs()
            val resource = createResource(resourceDir.absolutePath)
            whenever(mockBuild.resources).thenReturn(mutableListOf(resource))
            return this
        }
        
        fun withTestResources(): TestProject {
            val testResourceDir = tempDir.resolve("src/test/resources").toFile()
            testResourceDir.mkdirs()
            val resource = createResource(testResourceDir.absolutePath)
            whenever(mockBuild.testResources).thenReturn(mutableListOf(resource))
            return this
        }
        
        fun withDependency(groupId: String, artifactId: String, version: String, scope: String = "compile"): TestProject {
            val artifact = DefaultArtifact(groupId, artifactId, version, scope, "jar", "", null)
            val currentArtifacts = when (scope) {
                "test" -> mockProject.testArtifacts
                else -> mockProject.compileArtifacts
            }
            currentArtifacts.add(artifact)
            return this
        }
        
        private fun createPlugin(artifactId: String, phase: String, vararg goals: String): Plugin {
            val plugin = Plugin()
            plugin.artifactId = artifactId
            plugin.groupId = "org.apache.maven.plugins"
            
            if (goals.isNotEmpty()) {
                val execution = PluginExecution()
                execution.phase = phase
                execution.goals = goals.toMutableList()
                plugin.executions = listOf(execution)
            }
            
            return plugin
        }
        
        private fun createResource(directory: String): Resource {
            val resource = Resource()
            resource.directory = directory
            return resource
        }
    }
}