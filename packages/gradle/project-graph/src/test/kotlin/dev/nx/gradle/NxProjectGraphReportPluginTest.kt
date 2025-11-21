package dev.nx.gradle

import kotlin.test.assertEquals
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
}
