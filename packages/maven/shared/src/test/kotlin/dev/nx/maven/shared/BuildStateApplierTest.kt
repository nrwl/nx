package dev.nx.maven.shared

import org.apache.maven.artifact.DefaultArtifact
import org.apache.maven.artifact.handler.DefaultArtifactHandler
import org.apache.maven.model.Build
import org.apache.maven.model.Model
import org.apache.maven.project.MavenProject
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files
import kotlin.test.assertEquals
import kotlin.test.assertNull

class BuildStateApplierTest {

  @TempDir
  lateinit var tempDir: File

  private lateinit var workspaceRoot: File
  private lateinit var projectRoot: File
  private lateinit var outside: File
  private lateinit var project: MavenProject

  @BeforeEach
  fun setUp() {
    workspaceRoot = File(tempDir.canonicalFile, "workspace")
    projectRoot = File(workspaceRoot, "app")
    outside = File(tempDir.canonicalFile, "outside")
    listOf("target/classes", "target/test-classes", "target/generated-sources", "src/main/java").forEach {
      File(projectRoot, it).mkdirs()
    }
    File(workspaceRoot, "shared-resources").mkdirs()
    File(projectRoot, "target/app.jar").writeText("")
    File(projectRoot, ".flattened-pom.xml").writeText("")
    outside.mkdirs()
    File(outside, "file").writeText("")

    project = MavenProject(Model().apply {
      build = Build().apply {
        directory = File(projectRoot, "target").path
        outputDirectory = File(projectRoot, "target/classes").path
        testOutputDirectory = File(projectRoot, "target/test-classes").path
      }
    }).apply {
      file = File(projectRoot, "pom.xml")
      artifact = DefaultArtifact("com.example", "app", "1.0.0", "compile", "jar", null, DefaultArtifactHandler("jar"))
    }
  }

  private fun artifactInfo(file: String) = ArtifactInfo(file, "jar", null, "com.example", "app", "1.0.0")

  private fun apply(buildState: BuildState) = BuildStateApplier.applyBuildState(project, buildState, workspaceRoot)

  private fun stateWithEveryPath(dir: String) = BuildState(
    compileSourceRoots = setOf(dir),
    testCompileSourceRoots = setOf(dir),
    resources = setOf(dir),
    testResources = setOf(dir),
    outputDirectory = dir,
    testOutputDirectory = dir,
    mainArtifact = artifactInfo("$dir/file"),
    attachedArtifacts = listOf(artifactInfo("$dir/file")),
    pomFile = "$dir/file"
  )

  private fun assertNothingApplied() {
    assertEquals(emptyList(), project.compileSourceRoots)
    assertEquals(emptyList(), project.testCompileSourceRoots)
    assertEquals(emptyList(), project.resources)
    assertEquals(emptyList(), project.testResources)
    assertEquals(File(projectRoot, "target/classes").path, project.build.outputDirectory)
    assertEquals(File(projectRoot, "target/test-classes").path, project.build.testOutputDirectory)
    assertNull(project.artifact.file)
    assertEquals(emptyList(), project.attachedArtifacts)
    assertEquals(File(projectRoot, "pom.xml"), project.file)
  }

  @Test
  fun `applies paths inside the workspace and the build directory`() {
    apply(
      BuildState(
        compileSourceRoots = setOf("target/generated-sources", "../shared-resources"),
        testCompileSourceRoots = setOf("src/main/java"),
        resources = setOf("../shared-resources"),
        testResources = setOf("target/generated-sources"),
        outputDirectory = "target/generated-sources",
        testOutputDirectory = "target/test-classes",
        mainArtifact = artifactInfo("target/app.jar"),
        attachedArtifacts = emptyList(),
        pomFile = ".flattened-pom.xml"
      )
    )

    assertEquals(
      listOf(File(projectRoot, "target/generated-sources").path, File(workspaceRoot, "shared-resources").path),
      project.compileSourceRoots
    )
    assertEquals(listOf(File(projectRoot, "src/main/java").path), project.testCompileSourceRoots)
    assertEquals(listOf(File(workspaceRoot, "shared-resources").path), project.resources.map { it.directory })
    assertEquals(listOf(File(projectRoot, "target/generated-sources").path), project.testResources.map { it.directory })
    assertEquals(File(projectRoot, "target/generated-sources").path, project.build.outputDirectory)
    assertEquals(File(projectRoot, "target/test-classes").path, project.build.testOutputDirectory)
    assertEquals(File(projectRoot, "target/app.jar"), project.artifact.file)
    assertEquals(File(projectRoot, ".flattened-pom.xml"), project.file)
  }

  @Test
  fun `ignores absolute paths outside the workspace`() {
    apply(stateWithEveryPath(outside.path))
    assertNothingApplied()
  }

  @Test
  fun `ignores relative paths that escape the workspace`() {
    apply(stateWithEveryPath("../../outside"))
    assertNothingApplied()
  }

  @Test
  fun `ignores symlinks that leave the workspace`() {
    Files.createSymbolicLink(File(projectRoot, "target/link").toPath(), outside.toPath())
    apply(stateWithEveryPath("target/link"))
    assertNothingApplied()
  }

  @Test
  fun `ignores symlinks that leave the workspace behind a path too long to canonicalize`() {
    Files.createSymbolicLink(File(projectRoot, "target/link").toPath(), outside.toPath())
    apply(stateWithEveryPath(File(projectRoot, "target/link").path + "/a/..".repeat(1200)))
    assertNothingApplied()
  }

  @Test
  fun `ignores output directories outside the build directory`() {
    apply(
      BuildState(
        compileSourceRoots = emptySet(),
        testCompileSourceRoots = emptySet(),
        outputDirectory = "src/main/java",
        testOutputDirectory = "../shared-resources",
        mainArtifact = null,
        attachedArtifacts = emptyList()
      )
    )

    assertEquals(File(projectRoot, "target/classes").path, project.build.outputDirectory)
    assertEquals(File(projectRoot, "target/test-classes").path, project.build.testOutputDirectory)
  }

  @Test
  fun `keeps output directories the POM configured outside the build directory`() {
    project.build.outputDirectory = File(workspaceRoot, "out").path
    project.build.testOutputDirectory = File(workspaceRoot, "test-out").path
    val output = File(workspaceRoot, "out/sub").apply { mkdirs() }
    val testOutput = File(workspaceRoot, "test-out/sub").apply { mkdirs() }

    apply(
      BuildState(
        compileSourceRoots = emptySet(),
        testCompileSourceRoots = emptySet(),
        outputDirectory = "../out/sub",
        testOutputDirectory = "../test-out/sub",
        mainArtifact = null,
        attachedArtifacts = emptyList()
      )
    )

    assertEquals(output.path, project.build.outputDirectory)
    assertEquals(testOutput.path, project.build.testOutputDirectory)
  }
}
