package dev.nx.gradle

import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test

class NxProjectGraphReportPluginTest {

  @Test
  fun `should create nxProjectReport task with all required properties`() {
    val project = ProjectBuilder.builder().build()

    // Set required project properties
    project.extensions.extraProperties.set("hash", "test-hash")
    project.extensions.extraProperties.set("workspaceRoot", "/test/workspace")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created with all properties set
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    assertEquals(project.name, task.projectName.get())
    assertEquals(project.path, task.projectPath.get())
    assertEquals("test-hash", task.hash.get())
    assertEquals("/test/workspace", task.workspaceRoot.get())
    assertEquals(project, task.projectRef.get())
    assertEquals("Create Nx project report for ${project.name}", task.description)
    assertEquals("Reporting", task.group)
  }

  @Test
  fun `should not add compilation task dependencies`() {
    val project = ProjectBuilder.builder().build()

    // Create mock compilation tasks
    project.tasks.register("compileTestKotlin")
    project.tasks.register("compileTestJava")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    // Verify the task does not depend on compilation tasks to avoid circular dependencies
    val taskDependencies = task.taskDependencies.getDependencies(task)
    val compilationTasks = taskDependencies.filter { it.name.startsWith("compileTest") }
    assertTrue(compilationTasks.isEmpty())
  }

  @Test
  fun `should use the full project path as a cache input`() {
    val rootProject = ProjectBuilder.builder().build()
    val projectADir = File(rootProject.projectDir, "a").apply { mkdirs() }
    val projectBDir = File(rootProject.projectDir, "b").apply { mkdirs() }
    val apiADir = File(projectADir, "api").apply { mkdirs() }
    val apiBDir = File(projectBDir, "api").apply { mkdirs() }
    val projectA =
        ProjectBuilder.builder()
            .withParent(rootProject)
            .withName("a")
            .withProjectDir(projectADir)
            .build()
    val projectB =
        ProjectBuilder.builder()
            .withParent(rootProject)
            .withName("b")
            .withProjectDir(projectBDir)
            .build()
    val apiA =
        ProjectBuilder.builder()
            .withParent(projectA)
            .withName("api")
            .withProjectDir(apiADir)
            .build()
    val apiB =
        ProjectBuilder.builder()
            .withParent(projectB)
            .withName("api")
            .withProjectDir(apiBDir)
            .build()

    apiA.pluginManager.apply(NxProjectGraphReportPlugin::class.java)
    apiB.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    val taskA = apiA.tasks.named("nxProjectReport", NxProjectReportTask::class.java).get()
    val taskB = apiB.tasks.named("nxProjectReport", NxProjectReportTask::class.java).get()

    assertNotEquals(taskA.inputs.properties["projectPath"], taskB.inputs.properties["projectPath"])
  }
}
