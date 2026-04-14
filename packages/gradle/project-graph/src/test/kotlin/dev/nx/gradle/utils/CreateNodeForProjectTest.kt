package dev.nx.gradle.utils

import java.io.File
import kotlin.test.*
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class CreateNodeForProjectTest {

  @Test
  fun `should return GradleNodeReport with targets and metadata`(@TempDir workspaceDir: File) {
    // Arrange
    val workspaceRoot = workspaceDir.absolutePath
    val projectDir = File(workspaceRoot, "project-a").apply { mkdirs() }
    val project = ProjectBuilder.builder().withProjectDir(projectDir).build()

    // Create a couple of dummy tasks
    project.tasks.register("compileJava").get().apply {
      group = "build"
      description = "Compiles Java sources"
    }

    project.tasks.register("test").get().apply {
      group = "verification"
      description = "Runs the tests"
    }

    val targetNameOverrides = mapOf<String, String>()

    // Act
    val result =
        createNodeForProject(
            project = project,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = true)

    // Assert
    val projectRoot = project.projectDir.absolutePath
    assertTrue(result.nodes.containsKey(projectRoot), "Expected node for project root")

    val projectNode = result.nodes[projectRoot]
    assertNotNull(projectNode, "ProjectNode should not be null")

    // Check target metadata
    assertEquals(project.name, projectNode.name)
    assertNotNull(projectNode.targets["compileJava"], "Expected compileJava target")
    assertNotNull(projectNode.targets["test"], "Expected test target")

    // Dependencies and external nodes should default to empty
    assertTrue(result.dependencies.isEmpty(), "Expected no dependencies")
    assertTrue(result.externalNodes.isEmpty(), "Expected no external nodes")
  }

  @Test
  fun `should use buildTreePath as project name for subprojects`(@TempDir workspaceDir: File) {
    val workspaceRoot = workspaceDir.absolutePath
    val rootDir = File(workspaceRoot, "root").apply { mkdirs() }
    val appDir = File(rootDir, "app").apply { mkdirs() }

    val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
    val appProject =
        ProjectBuilder.builder()
            .withParent(rootProject)
            .withProjectDir(appDir)
            .withName("app")
            .build()

    appProject.tasks.register("compileJava").get()

    val result =
        createNodeForProject(
            project = appProject,
            targetNameOverrides = emptyMap(),
            workspaceRoot = workspaceRoot,
            atomized = false)

    val projectNode = result.nodes[appProject.projectDir.absolutePath]
    assertNotNull(projectNode)
    assertEquals(":app", projectNode.name, "Expected project name to be ':app' (buildTreePath)")
  }
}
