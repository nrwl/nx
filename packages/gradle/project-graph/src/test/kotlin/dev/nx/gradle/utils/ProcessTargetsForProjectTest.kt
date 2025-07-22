package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import kotlin.test.*
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class ProcessTargetsForProjectTest {

  @Test
  fun `should process targets correctly when atomized is true`(@TempDir workspaceDir: File) {
    // Arrange
    val workspaceRoot = workspaceDir.absolutePath
    val projectDir = File(workspaceRoot, "project-a").apply { mkdirs() }
    val project = ProjectBuilder.builder().withProjectDir(projectDir).build()

    // Create a build file so the task dependencies are properly detected
    val buildFile = File(projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    // Create tasks that would normally trigger atomized targets
    val testFile1 =
        File(projectDir, "src/test/kotlin/MyFirstTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyFirstTest")
        }

    val testTask =
        project.tasks.register("test").get().apply {
          group = "verification"
          description = "Runs the tests"
          inputs.files(project.files(testFile1))
        }
    project.tasks.register("compileTestKotlin").get().apply {
      inputs.files(project.files(testFile1))
    }

    val checkTask =
        project.tasks.register("check").get().apply {
          group = "verification"
          description = "Runs all checks"
          dependsOn(testTask)
        }
    project.tasks.register("build").get().apply {
      group = "build"
      description = "Assembles and tests"
      dependsOn(checkTask)
    }

    val targetNameOverrides =
        mapOf(
            "ciTestTargetName" to "ci-test",
            "ciCheckTargetName" to "ci-check",
            "ciBuildTargetName" to "ci-build")

    val dependencies = mutableSetOf<Dependency>() // Empty for this test's scope

    // Act
    val gradleTargets =
        processTargetsForProject(
            project = project,
            dependencies = dependencies,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = true)

    // Assert
    // Verify 'ci-test' should not be presented
    // But 'ci-check' and 'ci-build' targets should be present in the returned targets
    assertNull(
        gradleTargets.targets["ci-test"],
        "Expected ci-test target to NOT be present in processed targets")
    assertNotNull(
        gradleTargets.targets["ci-check"],
        "Expected ci-check target to be present in processed targets")
    assertNotNull(
        gradleTargets.targets["ci-build"],
        "Expected ci-build target to be present in processed targets")

    // Verify dependencies are rewritten for 'check' and 'build' tasks in the returned targets
    val checkTarget = gradleTargets.targets["check"]
    assertNotNull(checkTarget, "Check target should exist in processed targets")
    val checkDependsOn = checkTarget["dependsOn"] as? List<*>
    assertNotNull(checkDependsOn, "Check dependsOn should not be null in processed targets")
    assertTrue(
        checkDependsOn.contains("${project.name}:test"),
        "Expected 'check' to depend on 'test' in processed targets")

    val checkCiTarget = gradleTargets.targets["ci-check"]
    assertNotNull(checkCiTarget, "Check CI target should exist in processed targets")
    val checkCiDependsOn = checkCiTarget["dependsOn"] as? List<*>
    assertNotNull(checkCiDependsOn, "Check CI dependsOn should not be null in processed targets")
    assertTrue(
        checkCiDependsOn.contains("${project.name}:ci-test"),
        "Expected 'ci-check' to depend on 'ci-test' in processed targets")

    val buildTarget = gradleTargets.targets["build"]
    assertNotNull(buildTarget, "Build target should exist in processed targets")
    val buildDependsOn = buildTarget["dependsOn"] as? List<*>
    assertNotNull(buildDependsOn, "Build dependsOn should not be null in processed targets")
    assertTrue(
        buildDependsOn.contains("${project.name}:check"),
        "Expected 'build' to depend on 'check' in processed targets")

    val buildCiTarget = gradleTargets.targets["ci-build"]
    assertNotNull(buildCiTarget, "Build CI target should exist in processed targets")
    val buildCiDependsOn = buildCiTarget["dependsOn"] as? List<*>
    assertNotNull(buildCiDependsOn, "Build CI dependsOn should not be null in processed targets")
    assertTrue(
        buildCiDependsOn.contains("${project.name}:ci-check"),
        "Expected 'ci-build' to depend on 'ci-check' in processed targets")
  }

  @Test
  fun `should process targets correctly when atomized is false`(@TempDir workspaceDir: File) {
    // Arrange
    val workspaceRoot = workspaceDir.absolutePath
    val projectDir = File(workspaceRoot, "project-a").apply { mkdirs() }
    val project = ProjectBuilder.builder().withProjectDir(projectDir).build()

    // Create a build file so the task dependencies are properly detected
    val buildFile = File(projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    // Create tasks that would normally trigger atomized targets
    val testFile1 =
        File(projectDir, "src/test/kotlin/MyFirstTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyFirstTest")
        }

    val testTask =
        project.tasks.register("test").get().apply {
          group = "verification"
          description = "Runs the tests"
          inputs.files(project.files(testFile1))
        }
    project.tasks
        .register("compileTestKotlin")
        .get()
        .dependsOn(testTask) // This task name triggers ci test target logic

    val checkTask =
        project.tasks.register("check").get().apply {
          group = "verification"
          description = "Runs all checks"
          dependsOn(testTask)
        }
    project.tasks.register("build").get().apply {
      group = "build"
      description = "Assembles and tests"
      dependsOn(checkTask)
    }

    val targetNameOverrides =
        mapOf(
            "ciTestTargetName" to "ci-test",
            "ciCheckTargetName" to "ci-check",
            "ciBuildTargetName" to "ci-build")

    val dependencies = mutableSetOf<Dependency>() // Empty for this test's scope

    // Act
    val gradleTargets =
        processTargetsForProject(
            project = project,
            dependencies = dependencies,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = false) // Test with atomized = false

    // Assert
    // Verify that individual atomized targets are NOT created
    assertFalse(
        gradleTargets.targets.containsKey("ci--MyFirstTest"),
        "Expected ci--MyFirstTest target NOT to be present in processed targets")

    // Verify 'test' and 'check' targets are present but not their 'ci' counterparts if atomized is
    // false
    assertNotNull(gradleTargets.targets["test"], "Expected 'test' target to be present")
    assertNotNull(gradleTargets.targets["check"], "Expected 'check' target to be present")
    assertNotNull(gradleTargets.targets["build"], "Expected 'build' target to be present")

    // Verify that 'ci-test' is not created as main targets if atomized is false
    // 'ci-check' and 'ci-build should still be presented if ciTestTargetName is presented
    // regardless of atomized value
    assertFalse(
        gradleTargets.targets.containsKey("ci-test"),
        "Expected ci-test target NOT to be present as a main target")
    assertTrue(
        gradleTargets.targets.containsKey("ci-check"),
        "Expected ci-check target to be present as a main target")
    assertTrue(
        gradleTargets.targets.containsKey("ci-build"),
        "Expected ci-build target to be present as a main target")

    // Verify dependencies are NOT rewritten for 'check' and 'build' tasks
    val checkTarget = gradleTargets.targets["check"]
    assertNotNull(checkTarget, "Check target should exist")
    val checkDependsOn = checkTarget["dependsOn"] as? List<*>
    assertNotNull(checkDependsOn, "Check dependsOn should not be null")
    assertTrue(
        checkDependsOn.contains("${project.name}:test"), "Expected 'check' to depend on 'test'")
    assertFalse(
        checkDependsOn.contains("${project.name}:ci-test"),
        "Expected 'check' NOT to depend on 'ci-test'")

    val checkCiTarget = gradleTargets.targets["ci-check"]
    assertNotNull(checkCiTarget, "Check CI target should exist in processed targets")
    val checkCiDependsOn = checkCiTarget["dependsOn"] as? List<*>
    assertNotNull(checkCiDependsOn, "Check CI dependsOn should not be null in processed targets")
    assertFalse(
        checkCiDependsOn.contains("${project.name}:ci-test"),
        "Expected 'ci-check' to NOT depend on 'ci-test' in processed targets")
    assertTrue(
        checkCiDependsOn.contains("${project.name}:test"),
        "Expected 'ci-check' to depend on 'test' in processed targets")

    val buildTarget = gradleTargets.targets["build"]
    assertNotNull(buildTarget, "Build target should exist")
    val buildDependsOn = buildTarget["dependsOn"] as? List<*>
    assertNotNull(buildDependsOn, "Build dependsOn should not be null")
    assertTrue(
        buildDependsOn.contains("${project.name}:check"), "Expected 'build' to depend on 'check'")
    assertFalse(
        buildDependsOn.contains("${project.name}:ci-check"),
        "Expected 'build' NOT to depend on 'ci-check'")

    val buildCiTarget = gradleTargets.targets["ci-build"]
    assertNotNull(buildCiTarget, "Build CI target should exist in processed targets")
    val buildCiDependsOn = buildCiTarget["dependsOn"] as? List<*>
    assertNotNull(buildCiDependsOn, "Build CI dependsOn should not be null in processed targets")
    assertTrue(
        buildCiDependsOn.contains("${project.name}:ci-check"),
        "Expected 'ci-build' to depend on 'ci-check' in processed targets")
  }
}
