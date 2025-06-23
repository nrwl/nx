package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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
    testTask = project.tasks.create("test")
  }

  @Test
  fun `should use compiled test classes when available`() {
    // Create test source files (won't be used when compiled classes exist)
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
        ciTestTargetName = ciTestTargetName)

    // Should generate targets based on compiled classes, not source files
    assertTrue(targets.containsKey("ci--UserServiceTest"))
    assertTrue(targets.containsKey("ci--UserRepositoryTest"))
    assertTrue(targets.containsKey("ci--IntegrationTest"))

    // Should create parent CI target
    assertTrue(targets.containsKey("ci"))

    // Verify target groups
    val group = targetGroups[testCiTargetGroup]
    assertNotNull(group)
    assertTrue(group.contains("ci--UserServiceTest"))
    assertTrue(group.contains("ci--UserRepositoryTest"))
    assertTrue(group.contains("ci--IntegrationTest"))
    assertTrue(group.contains("ci"))
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

    // This should not crash even when no compiled classes exist
    val testClassNames = getCompiledTestClassNames(testTask, ":project-a")

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
          writeText("@Test class FallbackTest")
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
