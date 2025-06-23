package dev.nx.gradle

import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test

class NxProjectGraphReportPluginTest {

  @Test
  fun `should configure compileTest property from project property`() {
    val project = ProjectBuilder.builder().build()

    // Set the compileTest property on the project
    project.extensions.extraProperties.set("compileTest", "true")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    // Verify the compileTest property was set correctly
    assertTrue(task.compileTest.get())
  }

  @Test
  fun `should use default compileTest value when property not set`() {
    val project = ProjectBuilder.builder().build()

    // Apply the plugin without setting the compileTest property
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    // Verify the compileTest property uses default value (false)
    assertEquals(false, task.compileTest.get())
  }

  @Test
  fun `should handle compileTest property set to false`() {
    val project = ProjectBuilder.builder().build()

    // Set the compileTest property to false
    project.extensions.extraProperties.set("compileTest", "false")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    // Verify the compileTest property was set correctly
    assertEquals(false, task.compileTest.get())
  }

  @Test
  fun `should handle invalid compileTest property value`() {
    val project = ProjectBuilder.builder().build()

    // Set an invalid compileTest property value
    project.extensions.extraProperties.set("compileTest", "invalid")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    // Verify the compileTest property defaults to false for invalid values
    assertEquals(false, task.compileTest.get())
  }

  @Test
  fun `should create nxProjectReport task with all required properties`() {
    val project = ProjectBuilder.builder().build()

    // Set required project properties
    project.extensions.extraProperties.set("hash", "test-hash")
    project.extensions.extraProperties.set("workspaceRoot", "/test/workspace")
    project.extensions.extraProperties.set("compileTest", "true")

    // Apply the plugin
    project.pluginManager.apply(NxProjectGraphReportPlugin::class.java)

    // Verify the task was created with all properties set
    val task = project.tasks.findByName("nxProjectReport") as? NxProjectReportTask
    assertNotNull(task)

    assertEquals(project.name, task.projectName.get())
    assertEquals("test-hash", task.hash.get())
    assertEquals("/test/workspace", task.workspaceRoot.get())
    assertTrue(task.compileTest.get())
    assertEquals(project, task.projectRef.get())
    assertEquals("Create Nx project report for ${project.name}", task.description)
    assertEquals("Reporting", task.group)
  }
}
