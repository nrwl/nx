package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class AddTestCiTargetsTest {

  private lateinit var project: Project
  private lateinit var testTask: Task
  private lateinit var workspaceRoot: File
  private lateinit var projectRoot: File

  @BeforeEach
  fun setup() {
    workspaceRoot = createTempDir("workspace")
    projectRoot = File(workspaceRoot, "project-a").apply { mkdirs() }

    project = ProjectBuilder.builder().withProjectDir(projectRoot).build()
    testTask = project.task("test")
  }

  @Test
  fun `should generate test CI targets and group correctly`() {
    val testFile1 =
        File(projectRoot, "src/test/kotlin/MyFirstTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class MyFirstTest")
        }

    val testFile2 =
        File(projectRoot, "src/test/kotlin/AnotherTest.kt").apply {
          parentFile.mkdirs()
          writeText("@Test class AnotherTest")
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
    assertEquals(firstTarget["executor"], "@nx/gradle:gradlew")
    assertEquals(true, firstTarget["cache"])
    assertTrue((firstTarget["inputs"] as Array<*>)[0].toString().contains("{projectRoot}"))
    assertEquals("nx:noop", parentCi["executor"])
  }
}
