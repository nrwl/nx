package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.ExternalNode
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*

class ProcessTaskUtilsTest {

  @Test
  fun `test replaceRootInPath`() {
    val path = "/home/user/workspace/project/src/main/java"
    val projectRoot = "/home/user/workspace/project"
    val workspaceRoot = "/home/user/workspace"

    assertEquals("{projectRoot}/src/main/java", replaceRootInPath(path, projectRoot, workspaceRoot))
    assertEquals(
        "{workspaceRoot}/project/src/main/java",
        replaceRootInPath(path, "/other/path", workspaceRoot))
    assertNull(replaceRootInPath("/external/other", projectRoot, workspaceRoot))
  }

  @Test
  fun `test getGradlewCommand`() {
    val command = getGradlewCommand()
    assertTrue(command.contains("gradlew"))
  }

  @Test
  fun `test getMetadata`() {
    val metadata = getMetadata("Compile Java", ":project", "compileJava")
    assertEquals("Compile Java", metadata["description"])
    assertEquals("gradle", (metadata["technologies"] as Array<*>)[0])
  }

  @Test
  fun `test getExternalDepFromInputFile valid path`() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val path = "org/apache/commons/commons-lang3/3.13.0/hash/commons-lang3-3.13.0.jar"

    val key = getExternalDepFromInputFile(path, externalNodes, mock())

    assertEquals("gradle:commons-lang3-3.13.0", key)
    assertTrue(externalNodes.containsKey("gradle:commons-lang3-3.13.0"))
  }

  @Test
  fun `test getExternalDepFromInputFile invalid path`() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val key = getExternalDepFromInputFile("invalid/path.jar", externalNodes, mock())

    assertNull(key)
    assertTrue(externalNodes.isEmpty())
  }

  @Test
  fun `test getDependsOnForTask with direct dependsOn`() {
    val project = ProjectBuilder.builder().build()
    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()

    taskA.dependsOn(taskB)

    val dependencies = mutableSetOf<Dependency>()
    val dependsOn = getDependsOnForTask(taskA, dependencies)

    assertNotNull(dependsOn)
    assertTrue(dependsOn!!.contains("taskB"))
  }

  @Test
  fun `test processTask basic properties`() {
    val project = ProjectBuilder.builder().build()
    val task = project.tasks.register("compileJava").get()
    task.group = "build"
    task.description = "Compiles Java source files"

    val result =
        processTask(
            task,
            projectBuildPath = ":project",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap())

    assertEquals(true, result["cache"])
    assertEquals(result["executor"], "@nx/gradle:gradle")
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])
  }
}
