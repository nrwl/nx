package dev.nx.maven.utils

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

  @Test
  fun `shade adds no default source inputs`() {
    val analysis = analyze("maven-shade-plugin", "shade", "target/classes")
    assertEquals(emptySet(), analysis.inputs)
    assertEquals(emptySet(), analysis.ignoredInputs)
  }

  @Test
  fun `shade outputs only the jars and the dependency-reduced pom`() {
    assertEquals(
      setOf("{projectRoot}/target/*.jar", "{projectRoot}/dependency-reduced-pom.xml"),
      outputsOf(
        "maven-shade-plugin", "shade", "target/classes",
        fileParameter("outputDirectory", "\${project.build.directory}"),
        fileParameter("dependencyReducedPomLocation", "\${basedir}/dependency-reduced-pom.xml"),
      )
    )
  }

  @Test
  fun `build output inputs are includeIgnored outside the build directory`() {
    val analysis = analyze(
      "maven-jar-plugin", "jar", "bin/classes",
      fileParameter("classesDirectory", "\${project.build.outputDirectory}"),
    )
    assertEquals(setOf("{projectRoot}/bin/classes"), analysis.ignoredInputs)
    assertEquals(emptySet(), analysis.inputs)
  }

  @Test
  fun `source inputs are includeIgnored too`() {
    val analysis = analyze(
      "maven-war-plugin", "war", "target/classes",
      fileParameter("warSourceDirectory", "\${basedir}/src/main/webapp"),
    )
    assertEquals(emptySet(), analysis.inputs)
    assertEquals(setOf("{projectRoot}/src/main/webapp"), analysis.ignoredInputs)
  }

  @Test
  fun `compile hashes generated sources but not javac's own annotation output`() {
    assertEquals(
      setOf(
        "{projectRoot}/target/generated-sources/**/*.java",
        "!{projectRoot}/target/generated-sources/annotations/**",
      ),
      analyze(
        "maven-compiler-plugin", "compile", "target/classes",
        fileParameter("buildDirectory", "\${project.build.directory}"),
      ).ignoredInputs
    )
  }

  @Test
  fun `testCompile hashes main classes and generated test sources`() {
    assertEquals(
      setOf(
        "{projectRoot}/target/classes",
        "{projectRoot}/target/generated-test-sources/**/*.java",
        "!{projectRoot}/target/generated-test-sources/test-annotations/**",
      ),
      analyze(
        "maven-compiler-plugin", "testCompile", "target/classes",
        fileParameter("buildDirectory", "\${project.build.directory}"),
      ).ignoredInputs
    )
  }

  @Test
  fun `install and deploy hash the artifacts they publish`() {
    listOf("maven-install-plugin" to "install", "maven-deploy-plugin" to "deploy").forEach { (artifactId, goal) ->
      val analysis = analyze(artifactId, goal, "target/classes")
      assertEquals(false, analysis.isCacheable)
      assertEquals(setOf("{projectRoot}/target/app-1.0.jar", "{projectRoot}/target/app-1.0-*"), analysis.ignoredInputs)
      assertEquals(emptySet(), analysis.outputs)
    }
  }

  @Test
  fun `unconfigured non-cacheable goals get no inputs`() {
    val analysis = analyze("maven-clean-plugin", "clean", "target/classes")
    assertEquals(emptySet(), analysis.inputs)
    assertEquals(emptySet(), analysis.ignoredInputs)
  }

  private fun fileParameter(name: String, defaultValue: String? = null) = Parameter().apply {
    this.name = name
    type = "java.io.File"
    this.defaultValue = defaultValue
  }

  private fun outputsOf(
    artifactId: String,
    goal: String,
    outputDirectory: String,
    vararg parameters: Parameter = arrayOf(fileParameter("outputDirectory")),
  ): Set<String> = analyze(artifactId, goal, outputDirectory, *parameters).outputs

  private fun analyze(
    artifactId: String,
    goal: String,
    outputDirectory: String,
    vararg parameters: Parameter,
  ): MojoAnalysis {
    val basedir = File(workspaceRoot, "app")
    val project = MavenProject(Model().apply {
      build = Build().apply {
        directory = File(basedir, "target").path
        this.outputDirectory = File(basedir, outputDirectory).path
        finalName = "app-1.0"
      }
    }).apply { file = File(basedir, "pom.xml") }

    val pluginDescriptor = PluginDescriptor().apply { this.artifactId = artifactId }
    pluginDescriptor.addMojo(MojoDescriptor().apply {
      this.goal = goal
      parameters.forEach { addParameter(it) }
    })

    val analyzer = MojoAnalyzer(
      MavenExpressionResolver(
        MavenSession(DefaultRepositorySystemSession { false }, DefaultMavenExecutionRequest(), DefaultMavenExecutionResult())
      ),
      PathFormatter(),
      workspaceRoot,
    )
    return analyzer.analyzeMojo(pluginDescriptor, goal, project)!!
  }
}
