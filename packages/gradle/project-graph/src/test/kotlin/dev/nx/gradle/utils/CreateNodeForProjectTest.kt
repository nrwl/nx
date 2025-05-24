package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
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

  @Test
  fun `should not generate atomized targets when atomized is false`() {
    // Arrange
    val workspaceRoot = createTempDir("workspace").absolutePath
    val projectDir = createTempDir("project")
    val project = ProjectBuilder.builder().withProjectDir(projectDir).build()

    // Create tasks that would normally trigger atomized targets
    val testFile1 =
        File(projectDir, "src/test/kotlin/MyFirstTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyFirstTest")
        }

    val testTask =
        project.task("test").apply {
          group = "verification"
          description = "Runs the tests"
          inputs.files(project.files(testFile1))
        }
    project
        .task("compileTestKotlin")
        .dependsOn(testTask) // This task name triggers ci test target logic

    val checkTask =
        project.task("check").apply {
          group = "verification"
          description = "Runs all checks"
          dependsOn(testTask)
        }
    project.task("build").apply {
      group = "build"
      description = "Assembles and tests"
      dependsOn(checkTask)
    }

    val targetNameOverrides =
        mapOf(
            "ciTestTargetName" to "ci-test",
            "ciCheckTargetName" to "ci-check",
            "ciBuildTargetName" to "ci-build")

    // Act
    val result =
        createNodeForProject(
            project = project,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = false) // Test with atomized = false

    // Assert
    val projectRoot = project.projectDir.absolutePath
    val projectNode = result.nodes[projectRoot]
    assertNotNull(projectNode, "ProjectNode should not be null")

    // Verify that individual atomized targets are NOT created
    assertFalse(
        projectNode.targets.containsKey("ci--MyFirstTest"),
        "Expected ci--MyFirstTest target NOT to be present")

    // Verify 'test' and 'check' targets are present but not their 'ci' counterparts if atomized is
    // false
    assertNotNull(projectNode.targets["test"], "Expected 'test' target to be present")
    assertNotNull(projectNode.targets["check"], "Expected 'check' target to be present")
    assertNotNull(projectNode.targets["build"], "Expected 'build' target to be present")

    // Verify that 'ci-test', 'ci-check', 'ci-build' are not created as main targets if atomized is
    // false
    assertFalse(
        projectNode.targets.containsKey("ci-test"),
        "Expected ci-test target NOT to be present as a main target")
    assertFalse(
        projectNode.targets.containsKey("ci-check"),
        "Expected ci-check target NOT to be present as a main target")
    assertFalse(
        projectNode.targets.containsKey("ci-build"),
        "Expected ci-build target NOT to be present as a main target")

    // Verify dependencies are NOT rewritten for 'check' and 'build' tasks
    val checkTarget = projectNode.targets["check"]
    assertNotNull(checkTarget, "Check target should exist")
    val checkDependsOn = checkTarget["dependsOn"] as? List<*>
    assertNotNull(checkDependsOn, "Check dependsOn should not be null")
    assertTrue(
        checkDependsOn.contains("${project.name}:test"), "Expected 'check' to depend on 'test'")
    assertFalse(
        checkDependsOn.contains("${project.name}:ci-test"),
        "Expected 'check' NOT to depend on 'ci-test'")

    val buildTarget = projectNode.targets["build"]
    assertNotNull(buildTarget, "Build target should exist")
    val buildDependsOn = buildTarget["dependsOn"] as? List<*>
    assertNotNull(buildDependsOn, "Build dependsOn should not be null")
    assertTrue(
        buildDependsOn.contains("${project.name}:check"), "Expected 'build' to depend on 'check'")
    assertFalse(
        buildDependsOn.contains("${project.name}:ci-check"),
        "Expected 'build' NOT to depend on 'ci-check'")
  }
}
