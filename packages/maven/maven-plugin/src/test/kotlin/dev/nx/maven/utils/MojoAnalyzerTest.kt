package dev.nx.maven.utils

import dev.nx.maven.GitIgnoreClassifier
import org.apache.maven.execution.DefaultMavenExecutionRequest
import org.apache.maven.execution.DefaultMavenExecutionResult
import org.apache.maven.execution.MavenSession
import org.apache.maven.model.Build
import org.apache.maven.model.Model
import org.apache.maven.plugin.descriptor.MojoDescriptor
import org.apache.maven.plugin.descriptor.Parameter
import org.apache.maven.plugin.descriptor.PluginDescriptor
import org.apache.maven.project.MavenProject
import org.eclipse.aether.DefaultRepositorySystemSession
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals

class MojoAnalyzerTest {

  @TempDir
  lateinit var workspaceRoot: File

  @Test
  fun `resources outputs exclude class files`() {
    assertEquals(
      setOf("{projectRoot}/target/classes", "!{projectRoot}/target/classes/**/*.class"),
      outputsOf("maven-resources-plugin", "resources", "target/classes")
    )
    assertEquals(
      setOf("{projectRoot}/target/test-classes", "!{projectRoot}/target/test-classes/**/*.class"),
      outputsOf("maven-resources-plugin", "testResources", "target/test-classes")
    )
  }

  @Test
  fun `compile outputs only include class files`() {
    assertEquals(
      setOf("{projectRoot}/target/classes/**/*.class"),
      outputsOf("maven-compiler-plugin", "compile", "target/classes")
    )
    assertEquals(
      setOf("{projectRoot}/target/test-classes/**/*.class"),
      outputsOf("maven-compiler-plugin", "testCompile", "target/test-classes")
    )
  }

  private fun outputsOf(artifactId: String, goal: String, outputDirectory: String): Set<String> {
    val basedir = File(workspaceRoot, "app")
    val project = MavenProject(Model().apply {
      build = Build().apply { this.outputDirectory = File(basedir, outputDirectory).path }
    }).apply { file = File(basedir, "pom.xml") }

    val pluginDescriptor = PluginDescriptor().apply { this.artifactId = artifactId }
    pluginDescriptor.addMojo(MojoDescriptor().apply {
      this.goal = goal
      addParameter(Parameter().apply {
        name = "outputDirectory"
        type = "java.io.File"
      })
    })

    val analyzer = MojoAnalyzer(
      MavenExpressionResolver(
        MavenSession(DefaultRepositorySystemSession { false }, DefaultMavenExecutionRequest(), DefaultMavenExecutionResult())
      ),
      PathFormatter(),
      GitIgnoreClassifier(workspaceRoot),
      workspaceRoot,
    )
    return analyzer.analyzeMojo(pluginDescriptor, goal, project)!!.outputs
  }
}
