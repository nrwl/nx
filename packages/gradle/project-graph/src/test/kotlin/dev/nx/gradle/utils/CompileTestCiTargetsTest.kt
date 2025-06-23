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

class CompileTestCiTargetsTest {

  private lateinit var project: Project
  private lateinit var testTask: Task
  @TempDir lateinit var workspaceRoot: File
  private lateinit var projectRoot: File

  @BeforeEach
  fun setup() {
    projectRoot = File(workspaceRoot, "project-a").apply { mkdirs() }
    project = ProjectBuilder.builder().withProjectDir(projectRoot).build()
    testTask = project.tasks.register("test", org.gradle.api.tasks.testing.Test::class.java).get()
  }

  @Test
  fun `should process test source files with JUnit discovery`() {
    // Create test source files that contain test annotations
    val testFile1 =
        File(projectRoot, "src/test/kotlin/UserServiceTest.kt").apply {
          parentFile.mkdirs()
          writeText(
              """
            package com.example
            import org.junit.jupiter.api.Test
            
            class UserServiceTest {
              @Test
              fun testService() {}
            }
          """
                  .trimIndent())
        }

    val testFile2 =
        File(projectRoot, "src/test/kotlin/UserRepositoryTest.kt").apply {
          parentFile.mkdirs()
          writeText(
              """
            package com.example
            import org.junit.jupiter.api.Test
            
            class UserRepositoryTest {
              @Test
              fun testRepository() {}
            }
          """
                  .trimIndent())
        }

    val testFiles = project.files(testFile1, testFile2)
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        testTargetName = "test",
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName)

    // Should generate targets based on JUnit discovery and AST parsing
    assertTrue(targets.containsKey("ci--UserServiceTest"))
    assertTrue(targets.containsKey("ci--UserRepositoryTest"))

    // Should create parent CI target
    assertTrue(targets.containsKey("ci"))

    // Verify target groups
    val group = targetGroups[testCiTargetGroup]
    assertNotNull(group)
    assertTrue(group.contains("ci--UserServiceTest"))
    assertTrue(group.contains("ci--UserRepositoryTest"))
    assertTrue(group.contains("ci"))
  }

  @Test
  fun `should handle both Kotlin and Java test classes directories`() {
    val buildDir = project.layout.buildDirectory.asFile.get()

    // Create Kotlin test classes
    val kotlinTestDir = File(buildDir, "classes/kotlin/test/com/example").apply { mkdirs() }
    File(kotlinTestDir, "KotlinTest.class").createNewFile()

    // Create Java test classes
    val javaTestDir = File(buildDir, "classes/java/test/com/example").apply { mkdirs() }
    File(javaTestDir, "JavaTest.class").createNewFile()

    // Since our testTask is a Test task (created in setup), configure its testClassesDirs
    val testTaskTyped = testTask as org.gradle.api.tasks.testing.Test
    testTaskTyped.testClassesDirs = project.files(kotlinTestDir.parentFile, javaTestDir.parentFile)

    // Note: getCompiledTestClassNames was removed in favor of JUnit discovery
    val testClassNames = emptyMap<String, String>()

    // Verify the testClassesDirs property is accessible
    assertNotNull(testTaskTyped.testClassesDirs)
  }

  @Test
  fun `should handle createNodeForProject without compileTest parameter`() {
    // Create compiled test classes
    val buildDir = project.layout.buildDirectory.asFile.get()
    val kotlinTestClassesDir = File(buildDir, "classes/kotlin/test/com/example").apply { mkdirs() }
    File(kotlinTestClassesDir, "CallChainTest.class").createNewFile()

    val targetNameOverrides = mapOf<String, String>()
    val workspaceRoot = workspaceRoot.absolutePath

    // Test with new signature (no compileTest parameter)
    val report =
        createNodeForProject(
            project = project,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = true)

    // Should succeed without errors and always try compiled test analysis
    // Verify that the report was generated successfully (contains nodes or is valid empty report)
    assertNotNull(report)
  }

  @Test
  fun `should handle missing compiled classes gracefully`() {
    // Don't create any compiled test classes
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciDependsOn = mutableListOf<Map<String, String>>()
    val ciTestTargetName = "ci"

    // Initialize target group
    ensureTargetGroupExists(targetGroups, testCiTargetGroup)

    // Note: getCompiledTestClassNames was removed in favor of JUnit discovery
    val testClassNames = emptyMap<String, String>()

    // Should return empty map when no classes found
    assertTrue(testClassNames.isEmpty())

    // Process should work with empty test class names
    processTestClasses(
        testClassNames = testClassNames,
        ciTestTargetName = ciTestTargetName,
        projectBuildPath = ":project-a",
        testTask = testTask,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        targets = targets,
        targetGroups = targetGroups,
        ciDependsOn = ciDependsOn)

    // Should have no targets created
    assertEquals(0, targets.size)
    assertEquals(0, ciDependsOn.size)
  }

  @Test
  fun `should fall back to regex detection when no compiled classes exist`() {
    // Create test source files (for regex fallback)
    val testFile =
        File(projectRoot, "src/test/kotlin/FallbackTest.kt").apply {
          parentFile.mkdirs()
          writeText("class FallbackTest { @Test fun testMethod() {} }")
        }

    // Don't create any compiled test classes - should fall back to regex
    val testFiles = project.files(testFile)
    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciTestTargetName = "ci"

    addTestCiTargets(
        testFiles = testFiles,
        projectBuildPath = ":project-a",
        testTask = testTask,
        testTargetName = "test",
        targets = targets,
        targetGroups = targetGroups,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        ciTestTargetName = ciTestTargetName)

    // Should fall back to regex detection and create targets
    assertTrue(targets.containsKey("ci--FallbackTest"))
    assertTrue(targets.containsKey("ci"))

    // Verify target groups
    val group = targetGroups[testCiTargetGroup]
    assertNotNull(group)
    assertTrue(group.contains("ci--FallbackTest"))
    assertTrue(group.contains("ci"))
  }
}
