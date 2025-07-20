package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.FileCollection
import org.gradle.api.logging.Logger
import org.gradle.api.tasks.testing.Test
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test as JUnitTest
import org.mockito.Mockito.*

/** Integration tests for the Gradle test discovery functionality */
class GradleTestDiscoveryIntegrationTest {

  private lateinit var mockTask: Task
  private lateinit var mockTestTask: Test
  private lateinit var mockProject: Project
  private lateinit var mockLogger: Logger
  private lateinit var mockFileCollection: FileCollection
  private lateinit var targets: NxTargets
  private lateinit var targetGroups: TargetGroups

  @BeforeEach
  fun setup() {
    mockTask = mock(Task::class.java)
    mockTestTask = mock(Test::class.java)
    mockProject = mock(Project::class.java)
    mockLogger = mock(Logger::class.java)
    mockFileCollection = mock(FileCollection::class.java)

    targets = mutableMapOf()
    targetGroups = mutableMapOf()

    `when`(mockTask.logger).thenReturn(mockLogger)
    `when`(mockTask.path).thenReturn(":test")
    `when`(mockTask.project).thenReturn(mockProject)
    `when`(mockTask.name).thenReturn("test")

    `when`(mockTestTask.logger).thenReturn(mockLogger)
    `when`(mockTestTask.path).thenReturn(":test")
    `when`(mockTestTask.project).thenReturn(mockProject)
    `when`(mockTestTask.name).thenReturn("test")
  }

  @JUnitTest
  fun `processTestClasses creates targets correctly`() {
    val testClassNames =
        mapOf(
            "SimpleTestClass" to "dev.nx.gradle.utils.testdata.SimpleTestClass",
            "NestedTestClassInnerTests" to
                "dev.nx.gradle.utils.testdata.NestedTestClass\$InnerTests")

    val ciDependsOn = mutableListOf<Map<String, String>>()

    processTestClasses(
        testClassNames,
        "ci-test",
        ":project",
        mockTask,
        "/project/root",
        "/workspace/root",
        targets,
        targetGroups,
        ciDependsOn)

    assertEquals(2, targets.size)
    assertEquals(2, ciDependsOn.size)

    assertTrue(targets.containsKey("ci-test--SimpleTestClass"))
    assertTrue(targets.containsKey("ci-test--NestedTestClassInnerTests"))

    val simpleTarget = targets["ci-test--SimpleTestClass"]
    assertNotNull(simpleTarget)
    assertEquals("@nx/gradle:gradle", simpleTarget?.get("executor"))

    val options = simpleTarget?.get("options") as? Map<*, *>
    assertNotNull(options)
    assertEquals(":project:test", options?.get("taskName"))
    assertEquals("dev.nx.gradle.utils.testdata.SimpleTestClass", options?.get("testClassName"))
  }

  @JUnitTest
  fun `ensureTargetGroupExists creates target group if not exists`() {
    val targetGroups = mutableMapOf<String, MutableList<String>>()

    ensureTargetGroupExists(targetGroups, "verification")

    assertTrue(targetGroups.containsKey("verification"))
    assertEquals(0, targetGroups["verification"]?.size)
  }

  @JUnitTest
  fun `ensureTargetGroupExists does not overwrite existing target group`() {
    val targetGroups = mutableMapOf<String, MutableList<String>>()
    targetGroups["verification"] = mutableListOf("existing-target")

    ensureTargetGroupExists(targetGroups, "verification")

    assertTrue(targetGroups.containsKey("verification"))
    assertEquals(1, targetGroups["verification"]?.size)
    assertEquals("existing-target", targetGroups["verification"]?.get(0))
  }
}
