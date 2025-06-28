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
    val project = ProjectBuilder.builder().withName("myApp").build()
    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()

    taskA.dependsOn(taskB)

    val dependencies = mutableSetOf<Dependency>()
    val dependsOn = getDependsOnForTask(taskA, dependencies)

    assertNotNull(dependsOn)
    assertTrue(dependsOn!!.contains("myApp:taskB"))
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

  @Test
  fun `test getInputsForTask with dependsOn outputs exclusion`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path

    // Create dependent task with outputs
    val dependentTask = project.tasks.register("dependentTask").get()
    val outputFile = java.io.File("$workspaceRoot/dist/output.jar")
    dependentTask.outputs.file(outputFile)

    // Create main task with inputs and dependsOn
    val mainTask = project.tasks.register("mainTask").get()
    mainTask.dependsOn(dependentTask)

    // Add inputs - one that matches dependent output, one that doesn't
    val inputFile1 = java.io.File("$workspaceRoot/dist/output.jar") // Should be excluded
    val inputFile2 = java.io.File("$workspaceRoot/src/main.kt") // Should be included
    mainTask.inputs.files(inputFile1, inputFile2)

    val result = getInputsForTask(mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // Should contain dependentTasksOutputFiles for the output
    assertTrue(
        result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "dist/output.jar" })

    // Should contain the non-conflicting input file
    assertTrue(result.any { it == "{projectRoot}/src/main.kt" })

    // Should NOT contain the input file that matches dependent output
    assertFalse(result.any { it == "{workspaceRoot}/dist/output.jar" })
  }

  @Test
  fun `test getInputsForTask directory vs file patterns`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path

    val dependentTask = project.tasks.register("dependentTask").get()

    // Add file output (should get exact path)
    val outputFile = java.io.File("$workspaceRoot/dist/app.jar")
    dependentTask.outputs.file(outputFile)

    // Add directory output (should get /**/* pattern)
    val outputDir = java.io.File("$workspaceRoot/build/classes")
    dependentTask.outputs.dir(outputDir)

    val mainTask = project.tasks.register("mainTask").get()
    mainTask.dependsOn(dependentTask)

    val result = getInputsForTask(mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // File should get exact path
    assertTrue(
        result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "dist/app.jar" })

    // Directory should get glob pattern
    assertTrue(
        result.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String).endsWith("/**/*")
        })
  }

  @Test
  fun `test getInputsForTask excludes build directory files`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path
    val buildDir = project.layout.buildDirectory.get().asFile

    val mainTask = project.tasks.register("mainTask").get()

    // Add inputs - one in build dir, one outside
    val buildDirFile = java.io.File("${buildDir.path}/classes/Main.class")
    val sourceFile = java.io.File("$workspaceRoot/src/main.kt")
    mainTask.inputs.files(buildDirFile, sourceFile)

    val result = getInputsForTask(mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // Should contain the source file
    assertTrue(result!!.any { it == "{projectRoot}/src/main.kt" })

    // Should NOT contain the build directory file
    assertFalse(result.any { it.toString().contains("build") && it !is Map<*, *> })
  }

  @Test
  fun `test getInputsForTask with build dir input as dependentTasksOutputFiles`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path
    val buildDir = project.layout.buildDirectory.get().asFile

    // Create dependent task with build dir output
    val dependentTask = project.tasks.register("dependentTask").get()
    val buildDirOutput = java.io.File("${buildDir.path}/libs/app.jar")
    dependentTask.outputs.file(buildDirOutput)

    val mainTask = project.tasks.register("mainTask").get()
    mainTask.dependsOn(dependentTask)

    // Add build dir file as input that matches dependent output
    mainTask.inputs.files(buildDirOutput)

    val result = getInputsForTask(mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // Should contain dependentTasksOutputFiles for the build dir output
    assertTrue(
        result!!.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String).contains("libs/app.jar")
        })

    // Should NOT contain it as a regular input
    assertFalse(result.any { it.toString().contains("build") && it !is Map<*, *> })
  }
}
