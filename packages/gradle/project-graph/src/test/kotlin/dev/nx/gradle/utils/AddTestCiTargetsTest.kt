package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class AddTestCiTargetsTest {

  private lateinit var project: Project
  private lateinit var testTask: Task
  @TempDir lateinit var workspaceRoot: File
  private lateinit var projectRoot: File

  @BeforeEach
  fun setup() {
    taskDependencyCache.get().clear()
    projectRoot = File(workspaceRoot, "project-a").apply { mkdirs() }

    project = ProjectBuilder.builder().withProjectDir(projectRoot).build()
    testTask = project.tasks.register("test").get()
  }

  @Test
  fun `should generate test CI targets and group correctly`() {
    val testFile1 =
        File(projectRoot, "src/test/kotlin/MyFirstTest.kt").apply {
          parentFile.mkdirs()
          writeText("class MyFirstTest { @Test fun testMethod() {} }")
        }

    val testFile2 =
        File(projectRoot, "src/test/kotlin/AnotherTest.kt").apply {
          parentFile.mkdirs()
          writeText("class AnotherTest { @Test fun testMethod() {} }")
        }

    val testFiles = project.files(testFile1, testFile2)
    testTask.inputs.files(testFiles)

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier)

    // Assert each test file created a CI target
    assertTrue(targets.containsKey("ci--MyFirstTest"))
    assertTrue(targets.containsKey("ci--AnotherTest"))

    // Assert test group contains individual targets and parent ci task
    val group = targetGroups[testCiTargetGroup]
    assertTrue(group != null)
    assertTrue(group!!.contains("ci--MyFirstTest"))
    assertTrue(group.contains("ci--AnotherTest"))
    assertTrue(group.contains("ci"))

    // Assert parent CI task includes dependsOn
    val parentCi = targets["ci"]
    val dependsOn = parentCi?.get("dependsOn") as? List<*>
    assertEquals(2, dependsOn!!.size)

    val firstTarget = targets["ci--MyFirstTest"]!!
    assertEquals(firstTarget["executor"], "@nx/gradle:gradle")
    assertEquals(true, firstTarget["cache"])

    val actualInputs =
        firstTarget["inputs"] as? Collection<*> ?: error("Missing or invalid 'inputs' field")
    val actualInputStrings = actualInputs.map { it.toString() }

    testFiles.forEach { file ->
      val expectedInput =
          replaceRootInPath(file.path, projectRoot.absolutePath, workspaceRoot.absolutePath)
      assertTrue(
          expectedInput in actualInputStrings,
          "Expected input '$expectedInput' not found in actual inputs: $actualInputStrings")
    }

    assertEquals("nx:noop", parentCi["executor"])
  }

  @Test
  fun `should try compiled test analysis first then fallback to regex`() {
    val testFile =
        File(projectRoot, "src/test/kotlin/DefaultTest.kt").apply {
          parentFile.mkdirs()
          writeText("class DefaultTest { @Test fun testMethod() {} }")
        }

    val testFiles = project.files(testFile)
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)

    // Always tries compiled test analysis first, then falls back to regex
    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier)

    // Should create targets using regex-based approach since no compiled classes exist
    assertTrue(targets.containsKey("ci--DefaultTest"))
    assertTrue(targets.containsKey("ci"))
  }

  @Test
  fun `should not include same-project dependsOn for CI targets`() {
    File(projectRoot, "build.gradle").apply { writeText("// test build file") }

    val testFile =
        File(projectRoot, "src/test/kotlin/DependentTest.kt").apply {
          parentFile.mkdirs()
          writeText("class DependentTest { @Test fun testMethod() {} }")
        }

    val compileTask = project.tasks.register("compileTestKotlin").get()
    testTask.dependsOn(compileTask)

    val testFiles = project.files(testFile)
    testTask.inputs.files(testFiles)

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier)

    val ciTarget = targets["ci--DependentTest"]
    assertTrue(ciTarget != null, "CI target should be created")

    // Same-project dependencies should be included as object format without projects field
    val dependsOn = ciTarget?.get("dependsOn") as? List<*>
    assertNotNull(dependsOn, "Same-project dependsOn should be present")
    assertTrue(
        dependsOn!!.any { (it as? DependsOnEntry)?.target == "compileTestKotlin" },
        "Expected dependsOn to contain 'compileTestKotlin', got $dependsOn")
    assertTrue(
        dependsOn.all { (it as? DependsOnEntry)?.projects == null },
        "Same-project deps should not have projects field")
  }

  @Test
  fun `should skip abstract test classes`() {
    val abstractTestFile =
        File(projectRoot, "src/test/java/AbstractTest.java").apply {
          parentFile.mkdirs()
          writeText(
              """
              package com.example;
              import org.junit.jupiter.api.Test;

              abstract class AbstractTest {
                  @Test
                  void testMethod() {}
              }
              """
                  .trimIndent())
        }

    val concreteTestFile =
        File(projectRoot, "src/test/java/ConcreteTest.java").apply {
          parentFile.mkdirs()
          writeText(
              """
              package com.example;
              import org.junit.jupiter.api.Test;

              class ConcreteTest {
                  @Test
                  void testMethod() {}
              }
              """
                  .trimIndent())
        }

    val testFiles = project.files(abstractTestFile, concreteTestFile)
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier)

    // Abstract class should not create a CI target
    assertTrue(
        !targets.containsKey("ci--AbstractTest"),
        "Abstract test classes should not create CI targets")

    // Concrete class should create a CI target
    assertTrue(
        targets.containsKey("ci--ConcreteTest"), "Concrete test classes should create CI targets")
    assertTrue(targets.containsKey("ci"))
  }

  @Test
  fun `should apply targetNamePrefix to dependsOn entries`() {
    File(projectRoot, "build.gradle").apply { writeText("// test build file") }

    val testFile =
        File(projectRoot, "src/test/kotlin/PrefixedTest.kt").apply {
          parentFile.mkdirs()
          writeText("class PrefixedTest { @Test fun testMethod() {} }")
        }

    val compileTask = project.tasks.register("compileTestKotlin").get()
    val classesTask = project.tasks.register("classes").get()
    testTask.dependsOn(compileTask)
    testTask.dependsOn(classesTask)

    val testFiles = project.files(testFile)
    testTask.inputs.files(testFiles)

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "gradle-ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)
    val targetNamePrefix = "gradle-"

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier,
        targetNameOverrides = emptyMap(),
        targetNamePrefix = targetNamePrefix)

    val ciTarget = targets["gradle-ci--PrefixedTest"]
    assertTrue(ciTarget != null, "CI target should be created")

    val dependsOn = ciTarget?.get("dependsOn") as? List<*>
    assertNotNull(dependsOn, "dependsOn should be present")
    assertTrue(dependsOn!!.isNotEmpty(), "dependsOn should not be empty")

    val targetNames = dependsOn.mapNotNull { (it as? DependsOnEntry)?.target }
    assertTrue(
        targetNames.all { it.startsWith("gradle-") },
        "All dependsOn targets should have the prefix 'gradle-', got: $targetNames")
    assertTrue(
        targetNames.contains("gradle-compileTestKotlin"),
        "Expected dependsOn to contain 'gradle-compileTestKotlin', got: $targetNames")
    assertTrue(
        targetNames.contains("gradle-classes"),
        "Expected dependsOn to contain 'gradle-classes', got: $targetNames")
  }

  @Test
  fun `should apply targetNameOverrides in combination with targetNamePrefix`() {
    File(projectRoot, "build.gradle").apply { writeText("// test build file") }

    val testFile =
        File(projectRoot, "src/test/kotlin/OverriddenTest.kt").apply {
          parentFile.mkdirs()
          writeText("class OverriddenTest { @Test fun testMethod() {} }")
        }

    val libProject = ProjectBuilder.builder()
        .withProjectDir(File(workspaceRoot, "lib").apply { mkdirs() })
        .withParent(project)
        .build()
    File(libProject.projectDir, "build.gradle").apply { writeText("// lib build file") }
    val libTestTask = libProject.tasks.register("test").get()
    testTask.dependsOn(libTestTask)

    val testFiles = project.files(testFile)
    testTask.inputs.files(testFiles)

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "gradle-ci"
    val gitIgnoreClassifier = GitIgnoreClassifier(workspaceRoot)
    val targetNamePrefix = "gradle-"
    val targetNameOverrides = mapOf("testTargetName" to "unit-test")

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName,
        gitIgnoreClassifier = gitIgnoreClassifier,
        targetNameOverrides = targetNameOverrides,
        targetNamePrefix = targetNamePrefix)

    val ciTarget = targets["gradle-ci--OverriddenTest"]
    assertTrue(ciTarget != null, "CI target should be created")

    val dependsOn = ciTarget?.get("dependsOn") as? List<*>
    assertNotNull(dependsOn, "dependsOn should be present")

    val targetNames = dependsOn.mapNotNull { (it as? DependsOnEntry)?.target }
    assertTrue(
        targetNames.contains("gradle-unit-test"),
        "Expected dependsOn to contain 'gradle-unit-test' (prefixed overridden name for 'test' task), got: $targetNames")
  }
}
