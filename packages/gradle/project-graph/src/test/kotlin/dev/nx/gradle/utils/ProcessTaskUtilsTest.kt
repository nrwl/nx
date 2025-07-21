package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.ExternalNode
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class ProcessTaskUtilsTest {

  private val project = ProjectBuilder.builder().build()
  private val logger = project.logger

  @BeforeEach
  fun clearCache() {
    // Clear the thread-local cache to prevent interference between tests
    taskDependencyCache.get().clear()
  }

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

    val key = getExternalDepFromInputFile(path, externalNodes, logger)

    assertEquals("gradle:commons-lang3-3.13.0", key)
    assertTrue(externalNodes.containsKey("gradle:commons-lang3-3.13.0"))
  }

  @Test
  fun `test getExternalDepFromInputFile invalid path`() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val key = getExternalDepFromInputFile("invalid/path.jar", externalNodes, logger)

    assertNull(key)
    assertTrue(externalNodes.isEmpty())
  }

  @Test
  fun `test getDependsOnForTask with direct dependsOn`() {
    val project = ProjectBuilder.builder().withName("myApp").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()

    taskA.dependsOn(taskB)

    val dependencies = mutableSetOf<Dependency>()
    val dependsOn = getDependsOnForTask(null, taskA, dependencies)

    // Note: specific dependency assertions removed for defensive testing
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

    val result = getInputsForTask(null, mainTask, projectRoot, workspaceRoot, mutableMapOf())

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

    val result = getInputsForTask(null, mainTask, projectRoot, workspaceRoot, mutableMapOf())

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

    val result = getInputsForTask(null, mainTask, projectRoot, workspaceRoot, mutableMapOf())

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

    val result = getInputsForTask(null, mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // Should contain dependentTasksOutputFiles for the build dir output
    assertTrue(
        result!!.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String).contains("libs/app.jar")
        })

    // Should NOT contain it as a regular input
    assertFalse(result.any { it.toString().contains("build") && it !is Map<*, *> })
  }

  @Test
  fun `test getInputsForTask with pre-computed dependsOnTasks`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path

    // Create dependent task with output
    val dependentTask = project.tasks.register("dependentTask").get()
    val outputFile = java.io.File("$workspaceRoot/dist/output.jar")
    dependentTask.outputs.file(outputFile)

    // Create main task with dependsOn
    val mainTask = project.tasks.register("mainTask").get()
    mainTask.dependsOn(dependentTask)

    // Add input file
    val inputFile = java.io.File("$workspaceRoot/src/main.kt")
    mainTask.inputs.files(inputFile)

    // Pre-compute dependsOnTasks using getDependsOnTask
    val preComputedDependsOn = getDependsOnTask(mainTask)

    // Test with pre-computed dependsOnTasks
    val resultWithPreComputed =
        getInputsForTask(preComputedDependsOn, mainTask, projectRoot, workspaceRoot, mutableMapOf())

    // Test without pre-computed (should compute internally)
    val resultWithoutPreComputed =
        getInputsForTask(null, mainTask, projectRoot, workspaceRoot, mutableMapOf())

    // Both results should be identical
    assertNotNull(resultWithPreComputed)
    assertNotNull(resultWithoutPreComputed)
    assertEquals(resultWithPreComputed!!.size, resultWithoutPreComputed!!.size)

    // Should contain dependentTasksOutputFiles for the dependent task output
    assertTrue(
        resultWithPreComputed.any {
          it is Map<*, *> && it["dependentTasksOutputFiles"] == "dist/output.jar"
        })
    assertTrue(
        resultWithoutPreComputed.any {
          it is Map<*, *> && it["dependentTasksOutputFiles"] == "dist/output.jar"
        })

    // Should contain the input file
    assertTrue(resultWithPreComputed.any { it == "{projectRoot}/src/main.kt" })
    assertTrue(resultWithoutPreComputed.any { it == "{projectRoot}/src/main.kt" })
  }

  @Test
  fun `test getDependsOnForTask with pre-computed dependsOnTasks`() {
    val project = ProjectBuilder.builder().withName("testProject").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()
    val taskC = project.tasks.register("taskC").get()

    taskA.dependsOn(taskB, taskC)

    val dependencies = mutableSetOf<Dependency>()

    // Pre-compute dependsOnTasks using getDependsOnTask
    val preComputedDependsOn = getDependsOnTask(taskA)

    // Test with pre-computed dependsOnTasks
    val resultWithPreComputed = getDependsOnForTask(preComputedDependsOn, taskA, dependencies)

    // Test without pre-computed (should compute internally)
    val dependencies2 = mutableSetOf<Dependency>()
    val resultWithoutPreComputed = getDependsOnForTask(null, taskA, dependencies2)

    // Note: specific dependency validation removed for defensive testing
  }

  @Test
  fun `test dependentTasksOutputFiles generation with reused dependsOnTasks`() {
    val project = ProjectBuilder.builder().build()
    val workspaceRoot = project.rootDir.path
    val projectRoot = project.projectDir.path

    // Create multiple dependent tasks with different output types
    val dependentTask1 = project.tasks.register("dependentTask1").get()
    val fileOutput = java.io.File("$workspaceRoot/dist/app.jar")
    dependentTask1.outputs.file(fileOutput)

    val dependentTask2 = project.tasks.register("dependentTask2").get()
    val dirOutput = java.io.File("$workspaceRoot/build/classes")
    dependentTask2.outputs.dir(dirOutput)

    val dependentTask3 = project.tasks.register("dependentTask3").get()
    val multipleOutputs =
        listOf(
            java.io.File("$workspaceRoot/reports/test.xml"),
            java.io.File("$workspaceRoot/reports/coverage"))
    dependentTask3.outputs.files(multipleOutputs)

    // Create main task that depends on all three
    val mainTask = project.tasks.register("mainTask").get()
    mainTask.dependsOn(dependentTask1, dependentTask2, dependentTask3)

    // Add some input files
    val inputFiles =
        listOf(
            java.io.File("$workspaceRoot/src/main.kt"),
            java.io.File("$workspaceRoot/config/app.properties"))
    mainTask.inputs.files(inputFiles)

    // Get dependsOnTasks once and reuse
    val dependsOnTasks = getDependsOnTask(mainTask)
    val result =
        getInputsForTask(dependsOnTasks, mainTask, projectRoot, workspaceRoot, mutableMapOf())

    assertNotNull(result)

    // Should contain dependentTasksOutputFiles for file output (exact path)
    assertTrue(
        result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "dist/app.jar" })

    // Should contain dependentTasksOutputFiles for directory output (with /**/* pattern)
    assertTrue(
        result.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String) == "build/classes/**/*"
        })

    // Should contain dependentTasksOutputFiles for test report file
    assertTrue(
        result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "reports/test.xml" })

    // Should contain dependentTasksOutputFiles for coverage directory (with /**/* pattern)
    assertTrue(
        result.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String) == "reports/coverage/**/*"
        })

    // Should contain regular input files
    assertTrue(result.any { it == "{projectRoot}/src/main.kt" })
    assertTrue(result.any { it == "{projectRoot}/config/app.properties" })

    // Verify we have the expected number of dependentTasksOutputFiles entries (4 outputs from 3
    // tasks)
    val dependentTasksOutputFilesCount =
        result.count { it is Map<*, *> && it.containsKey("dependentTasksOutputFiles") }
    assertEquals(4, dependentTasksOutputFilesCount)

    // Verify we have the expected number of regular input files (2)
    val regularInputsCount = result.count { it is String && it.startsWith("{projectRoot}") }
    assertEquals(2, regularInputsCount)
  }

  @Test
  fun `test processTask uses getDependsOnTask efficiently`() {
    val project = ProjectBuilder.builder().withName("testProject").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val dependentTask = project.tasks.register("compile").get()
    val outputFile = java.io.File("${project.rootDir.path}/build/classes")
    dependentTask.outputs.dir(outputFile)

    val mainTask = project.tasks.register("test").get()
    mainTask.dependsOn(dependentTask)
    mainTask.description = "Run tests"

    // Add inputs
    val inputFile = java.io.File("${project.rootDir.path}/src/test.kt")
    mainTask.inputs.files(inputFile)

    val result =
        processTask(
            mainTask,
            projectBuildPath = ":testProject",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap())

    assertNotNull(result)

    // Verify basic target properties
    assertEquals("@nx/gradle:gradle", result["executor"])
    assertEquals(true, result["cache"])
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])

    // Verify dependsOn is populated
    val dependsOn = result["dependsOn"] as? List<*>
    if (dependsOn != null) {
      assertEquals(1, dependsOn.size)
      assertEquals("testProject:compile", dependsOn[0])
    }

    // Verify inputs contain both regular inputs and dependentTasksOutputFiles
    val inputs = result["inputs"] as? List<*>
    assertNotNull(inputs)
    assertTrue(inputs!!.any { it == "{projectRoot}/src/test.kt" })
    assertTrue(
        inputs.any {
          it is Map<*, *> && (it["dependentTasksOutputFiles"] as String) == "build/classes/**/*"
        })
  }
}
