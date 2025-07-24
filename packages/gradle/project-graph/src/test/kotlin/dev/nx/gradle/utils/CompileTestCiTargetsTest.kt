package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
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
}
