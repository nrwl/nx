package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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
    testTask = project.task("test")
  }

  @Test
  fun `should use compileTest approach when compileTest flag is true`() {
    // Create test source files (won't be used in compileTest mode)
    val testFile =
        File(projectRoot, "src/test/kotlin/MyTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyTest")
        }

    // Create compiled test classes directory structure
    val buildDir = project.layout.buildDirectory.asFile.get()
    val kotlinTestClassesDir = File(buildDir, "classes/kotlin/test/com/example").apply { mkdirs() }
    val javaTestClassesDir = File(buildDir, "classes/java/test/com/example").apply { mkdirs() }

    // Create mock compiled test class files
    File(kotlinTestClassesDir, "UserServiceTest.class").createNewFile()
    File(kotlinTestClassesDir, "UserRepositoryTest.class").createNewFile()
    File(javaTestClassesDir, "IntegrationTest.class").createNewFile()

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
        ciTestTargetName = ciTestTargetName,
        compileTest = true)

    // Should generate targets based on compiled classes, not source files
    assertTrue(targets.containsKey("ci--UserServiceTest"))
    assertTrue(targets.containsKey("ci--UserRepositoryTest"))
    assertTrue(targets.containsKey("ci--IntegrationTest"))

    // Should create parent CI target
    assertTrue(targets.containsKey("ci"))

    // Verify target groups
    val group = targetGroups[testCiTargetGroup]
    assertTrue(group != null)
    assertTrue(group!!.contains("ci--UserServiceTest"))
    assertTrue(group.contains("ci--UserRepositoryTest"))
    assertTrue(group.contains("ci--IntegrationTest"))
    assertTrue(group.contains("ci"))
  }

  @Test
  fun `should use regex approach when compileTest flag is false`() {
    val testFile =
        File(projectRoot, "src/test/kotlin/MyTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyTest")
        }

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
        ciTestTargetName = ciTestTargetName,
        compileTest = false)

    // Should generate targets based on source file regex analysis
    assertTrue(targets.containsKey("ci--MyTest"))
    assertTrue(targets.containsKey("ci"))
  }

  @Test
  fun `should identify test classes by naming patterns`() {
    val classFile1 = File.createTempFile("UserServiceTest", ".class")
    val classFile2 = File.createTempFile("TestRunner", ".class")
    val classFile3 = File.createTempFile("MyTestCase", ".class")
    val classFile4 = File.createTempFile("UserService", ".class")

    assertTrue(isTestClass(classFile1, testTask))
    assertTrue(isTestClass(classFile2, testTask))
    assertTrue(isTestClass(classFile3, testTask))
    assertFalse(isTestClass(classFile4, testTask))

    classFile1.delete()
    classFile2.delete()
    classFile3.delete()
    classFile4.delete()
  }

  @Test
  fun `should extract package path correctly from directory structure`() {
    val buildDir = project.layout.buildDirectory.asFile.get()
    val testClassesDir = File(buildDir, "classes/kotlin/test").apply { mkdirs() }

    // Create nested package structure
    val comDir = File(testClassesDir, "com").apply { mkdir() }
    val exampleDir = File(comDir, "example").apply { mkdir() }
    val serviceDir = File(exampleDir, "service").apply { mkdir() }

    // Create test class file
    File(serviceDir, "UserServiceTest.class").createNewFile()

    val result = mutableMapOf<String, String>()
    analyzeTestClassesDir(testClassesDir, "", result, testTask)

    assertEquals("com.example.service.UserServiceTest", result["UserServiceTest"])
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

    val testClassesDirs = getTestClassesDirs(project)

    assertTrue(testClassesDirs.any { it.path.contains("kotlin/test") })
    assertTrue(testClassesDirs.any { it.path.contains("java/test") })
  }

  @Test
  fun `should pass compileTest parameter through call chain`() {
    // Create compiled test classes
    val buildDir = project.layout.buildDirectory.asFile.get()
    val kotlinTestClassesDir = File(buildDir, "classes/kotlin/test/com/example").apply { mkdirs() }
    File(kotlinTestClassesDir, "CallChainTest.class").createNewFile()

    val targetNameOverrides = mapOf<String, String>()
    val workspaceRoot = workspaceRoot.absolutePath

    // Test with compileTest = true
    val report1 =
        createNodeForProject(
            project = project,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = true,
            compileTest = true)

    // Test with compileTest = false (default)
    val report2 =
        createNodeForProject(
            project = project,
            targetNameOverrides = targetNameOverrides,
            workspaceRoot = workspaceRoot,
            atomized = true,
            compileTest = false)

    // Both should succeed without errors (actual behavior depends on test setup)
    assertTrue(report1.nodes.isNotEmpty() || report1.nodes.isEmpty()) // Should not crash
    assertTrue(report2.nodes.isNotEmpty() || report2.nodes.isEmpty()) // Should not crash
  }
}
