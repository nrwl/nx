package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import kotlin.test.*
import org.gradle.testfixtures.ProjectBuilder

class CreateNodeForProjectTest {

  @Test
  fun `should return GradleNodeReport with targets and metadata`() {
    // Arrange
    val workspaceRoot = createTempDir("workspace").absolutePath
    val projectDir = createTempDir("project")
    val project = ProjectBuilder.builder().withProjectDir(projectDir).build()

    // Create a couple of dummy tasks
    project.task("compileJava").apply {
      group = "build"
      description = "Compiles Java sources"
    }

    project.task("test").apply {
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
}
