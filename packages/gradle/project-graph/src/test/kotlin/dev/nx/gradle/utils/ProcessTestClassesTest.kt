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
import org.junit.jupiter.api.io.TempDir

class ProcessTestClassesTest {

  private lateinit var project: Project
  private lateinit var testTask: Task
  @TempDir lateinit var workspaceRoot: File
  private lateinit var projectRoot: File

  @BeforeEach
  fun setup() {
    projectRoot = File(workspaceRoot, "project-a").apply { mkdirs() }
    project = ProjectBuilder.builder().withProjectDir(projectRoot).build()
    testTask = project.tasks.register("test").get()
  }

  @Test
  fun `processTestClasses should create targets for all test classes`() {
    val testClassNames =
        mapOf(
            "UserServiceTest" to "com.example.service.UserServiceTest",
            "UserRepositoryTest" to "com.example.repository.UserRepositoryTest",
            "IntegrationTest" to "com.example.IntegrationTest")

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciDependsOn = mutableListOf<Map<String, String>>()
    val ciTestTargetName = "ci"

    // Initialize target group
    ensureTargetGroupExists(targetGroups, testCiTargetGroup)

    // Call the function under test
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

    // Verify targets were created
    assertEquals(3, targets.size)
    assertTrue(targets.containsKey("ci--UserServiceTest"))
    assertTrue(targets.containsKey("ci--UserRepositoryTest"))
    assertTrue(targets.containsKey("ci--IntegrationTest"))

    // Verify target groups were updated
    val group = targetGroups[testCiTargetGroup]
    assertTrue(group != null)
    assertEquals(3, group!!.size)
    assertTrue(group.contains("ci--UserServiceTest"))
    assertTrue(group.contains("ci--UserRepositoryTest"))
    assertTrue(group.contains("ci--IntegrationTest"))

    // Verify ciDependsOn was populated
    assertEquals(3, ciDependsOn.size)
    assertTrue(ciDependsOn.any { it["target"] == "ci--UserServiceTest" })
    assertTrue(ciDependsOn.any { it["target"] == "ci--UserRepositoryTest" })
    assertTrue(ciDependsOn.any { it["target"] == "ci--IntegrationTest" })

    // Verify target structure
    val userServiceTarget = targets["ci--UserServiceTest"]!!
    assertEquals("@nx/gradle:gradle", userServiceTarget["executor"])
    assertEquals(true, userServiceTarget["cache"])

    val options = userServiceTarget["options"] as Map<*, *>
    assertEquals(":project-a:test", options["taskName"])
    assertEquals("com.example.service.UserServiceTest", options["testClassName"])
  }

  @Test
  fun `processTestClasses should handle empty test class map`() {
    val testClassNames = emptyMap<String, String>()

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciDependsOn = mutableListOf<Map<String, String>>()
    val ciTestTargetName = "ci"

    // Initialize target group
    ensureTargetGroupExists(targetGroups, testCiTargetGroup)

    // Call the function under test
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

    // Verify no targets were created
    assertEquals(0, targets.size)
    assertEquals(0, ciDependsOn.size)

    // Target group should still exist but be empty
    val group = targetGroups[testCiTargetGroup]
    assertTrue(group != null)
    assertEquals(0, group!!.size)
  }

  @Test
  fun `processTestClasses should handle single test class`() {
    val testClassNames = mapOf("SingleTest" to "com.example.SingleTest")

    val targets = mutableMapOf<String, MutableMap<String, Any?>>()
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    val ciDependsOn = mutableListOf<Map<String, String>>()
    val ciTestTargetName = "custom-ci"

    // Initialize target group
    ensureTargetGroupExists(targetGroups, testCiTargetGroup)

    // Call the function under test
    processTestClasses(
        testClassNames = testClassNames,
        ciTestTargetName = ciTestTargetName,
        projectBuildPath = ":custom-project",
        testTask = testTask,
        projectRoot = projectRoot.absolutePath,
        workspaceRoot = workspaceRoot.absolutePath,
        targets = targets,
        targetGroups = targetGroups,
        ciDependsOn = ciDependsOn)

    // Verify single target was created with custom naming
    assertEquals(1, targets.size)
    assertTrue(targets.containsKey("custom-ci--SingleTest"))

    val target = targets["custom-ci--SingleTest"]!!
    val options = target["options"] as Map<*, *>
    assertEquals(":custom-project:test", options["taskName"])
    assertEquals("com.example.SingleTest", options["testClassName"])

    // Verify ciDependsOn entry
    assertEquals(1, ciDependsOn.size)
    val dependsOnEntry = ciDependsOn.first()
    assertEquals("custom-ci--SingleTest", dependsOnEntry["target"])
    assertEquals("self", dependsOnEntry["projects"])
    assertEquals("forward", dependsOnEntry["params"])
  }
}
