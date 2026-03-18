package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.DependsOnEntry
import dev.nx.gradle.data.ExternalNode
import org.gradle.api.Project
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
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
        replaceRootInPath(path, "/other/path", workspaceRoot),
    )
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
  fun `test getDependsOnForTask with direct dependsOn same project returns null`() {
    val project = ProjectBuilder.builder().withName("myApp").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()

    taskA.dependsOn(taskB)

    val dependencies = mutableSetOf<Dependency>()
    val dependsOn = getDependsOnForTask(null, taskA, dependencies)

    // Same-project dependencies use object format without projects field
    assertNotNull(dependsOn, "Same-project dependsOn should be present")
    assertEquals(1, dependsOn!!.size)
    assertEquals("taskB", dependsOn[0].target)
    assertNull(dependsOn[0].projects, "Same-project deps should not have projects field")
  }

  @Test
  fun `test processTask basic properties`() {
    val project = ProjectBuilder.builder().build()
    val task = project.tasks.register("compileJava").get()
    task.group = "build"
    task.description = "Compiles Java source files"

    val gitIgnoreClassifier = GitIgnoreClassifier(project.rootDir)
    val result =
        processTask(
            task,
            projectBuildPath = ":project",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap(),
            gitIgnoreClassifier = gitIgnoreClassifier,
            project = project,
        )

    assertEquals(true, result["cache"])
    assertEquals(result["executor"], "@nx/gradle:gradle")
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])
  }

  @Nested
  inner class GetInputsForTaskTests {
    lateinit var project: Project
    lateinit var workspaceRoot: String
    lateinit var projectRoot: String

    @BeforeEach
    fun projectSetup() {
      project = ProjectBuilder.builder().build()
      workspaceRoot = project.rootDir.path
      projectRoot = project.projectDir.path

      val gitIgnore = java.io.File(workspaceRoot, ".gitignore")
      // Any inputs of tasks that are found in ignored files are considered dependent task output
      // files
      gitIgnore.writeText("dist")
    }

    @Test
    fun `test getInputsForTask with dependsOn outputs exclusion`() {
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

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      assertNotNull(result)

      // Should contain consolidated dependentTasksOutputFiles glob pattern for jar extension
      assertTrue(result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar" })

      // Should contain the non-conflicting input file
      assertTrue(result.any { it == "{projectRoot}/src/main.kt" })
    }

    @Test
    fun `test getInputsForTask consolidates by extension`() {
      val dependentTask = project.tasks.register("dependentTask").get()

      // Add file outputs with different extensions
      val jarFile = java.io.File("$workspaceRoot/dist/app.jar")
      val classFile = java.io.File("$workspaceRoot/dist/classes/Main.class")
      dependentTask.outputs.file(jarFile)
      dependentTask.outputs.file(classFile)

      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      assertNotNull(result)

      // Should have consolidated glob patterns by extension
      assertTrue(result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar" })
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })

      // Should only have 2 dependentTasksOutputFiles entries (one per extension)
      val dependentTasksOutputFilesCount = result.count {
        it is Map<*, *> && it.containsKey("dependentTasksOutputFiles")
      }
      assertEquals(2, dependentTasksOutputFilesCount)
    }

    @Test
    fun `test getInputsForTask with pre-computed dependsOnTasks`() {
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

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      // Test with pre-computed dependsOnTasks
      val resultWithPreComputed =
          getInputsForTask(
              preComputedDependsOn,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      // Test without pre-computed (should compute internally)
      val resultWithoutPreComputed =
          getInputsForTask(
              null,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      // Both results should be identical
      assertNotNull(resultWithPreComputed)
      assertNotNull(resultWithoutPreComputed)
      assertEquals(resultWithPreComputed!!.size, resultWithoutPreComputed!!.size)

      // Should contain consolidated dependentTasksOutputFiles glob pattern
      assertTrue(
          resultWithPreComputed.any {
            it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar"
          }
      )
      assertTrue(
          resultWithoutPreComputed.any {
            it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar"
          }
      )

      // Should contain the input file
      assertTrue(resultWithPreComputed.any { it == "{projectRoot}/src/main.kt" })
      assertTrue(resultWithoutPreComputed.any { it == "{projectRoot}/src/main.kt" })
    }

    @Test
    fun `test getDependsOnForTask with pre-computed dependsOnTasks same project returns null`() {
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

      // Same-project dependencies use object format without projects field
      assertNotNull(
          resultWithPreComputed,
          "Same-project dependsOn should be present (pre-computed)",
      )
      assertNotNull(resultWithoutPreComputed, "Same-project dependsOn should be present (computed)")
      assertEquals(2, resultWithPreComputed!!.size)
      assertEquals(2, resultWithoutPreComputed!!.size)
      assertTrue(
          resultWithPreComputed.all { it.projects == null },
          "Same-project deps should not have projects field",
      )
    }

    @Test
    fun `test dependentTasksOutputFiles consolidation with multiple tasks`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create multiple dependent tasks with different output types
      val dependentTask1 = project.tasks.register("dependentTask1").get()
      val fileOutput = java.io.File("$workspaceRoot/dist/app.jar")
      dependentTask1.outputs.file(fileOutput)

      val dependentTask2 = project.tasks.register("dependentTask2").get()
      val classFile = java.io.File("$workspaceRoot/build/classes/Main.class")
      dependentTask2.outputs.file(classFile)

      val dependentTask3 = project.tasks.register("dependentTask3").get()
      val multipleOutputs =
          listOf(
              java.io.File("$workspaceRoot/reports/test.xml"),
              java.io.File("$workspaceRoot/reports/another.jar"),
          )
      dependentTask3.outputs.files(multipleOutputs)

      // Create main task that depends on all three
      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask1, dependentTask2, dependentTask3)

      // Add some input files
      val inputFiles =
          listOf(
              java.io.File("$workspaceRoot/src/main.kt"),
              java.io.File("$workspaceRoot/config/app.properties"),
          )
      mainTask.inputs.files(inputFiles)

      // Get dependsOnTasks once and reuse
      val dependsOnTasks = getDependsOnTask(mainTask)
      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              dependsOnTasks,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      assertNotNull(result)

      // Should have consolidated glob patterns by extension
      assertTrue(result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar" })
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.xml" })

      // Should contain regular input files
      assertTrue(result.any { it == "{projectRoot}/src/main.kt" })
      assertTrue(result.any { it == "{projectRoot}/config/app.properties" })

      // Verify we have exactly 3 dependentTasksOutputFiles entries (one per unique extension: jar,
      // class, xml)
      val dependentTasksOutputFilesCount = result.count {
        it is Map<*, *> && it.containsKey("dependentTasksOutputFiles")
      }
      assertEquals(3, dependentTasksOutputFilesCount)

      // Verify we have the expected number of regular input files (2)
      val regularInputsCount = result.count { it is String && it.startsWith("{projectRoot}") }
      assertEquals(2, regularInputsCount)
    }

    @Test
    fun `test getInputsForTask with gitignore classification`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create .gitignore file
      val gitignore = java.io.File(project.rootDir, ".gitignore")
      gitignore.writeText(
          """
          build
          .gradle
          *.log
          dist
          """
              .trimIndent()
      )

      val mainTask = project.tasks.register("mainTask").get()

      // Add inputs with mixed types
      val sourceFile = java.io.File("$workspaceRoot/src/main.kt") // Not ignored - should be input
      val buildFile = java.io.File("$workspaceRoot/build/classes/Main.class") // Ignored - should be
      // dependentTasksOutputFiles
      val logFile =
          java.io.File("$workspaceRoot/app.log") // Ignored - should be dependentTasksOutputFiles
      val configFile =
          java.io.File("$workspaceRoot/config/app.properties") // Not ignored - should be input

      mainTask.inputs.files(sourceFile, buildFile, logFile, configFile)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      assertNotNull(result)

      // Source file should be regular input
      assertTrue(result!!.any { it == "{projectRoot}/src/main.kt" })

      // Config file should be regular input
      assertTrue(result.any { it == "{projectRoot}/config/app.properties" })

      // Build file (class extension) should be consolidated into dependentTasksOutputFiles glob
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })

      // Log file should be consolidated into dependentTasksOutputFiles glob
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.log" })
    }

    @Test
    fun `test getInputsForTask gitignore patterns with nested paths`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create .gitignore with common patterns
      val gitignore = java.io.File(project.rootDir, ".gitignore")
      gitignore.writeText(
          """
          target
          dist
          """
              .trimIndent()
      )

      val mainTask = project.tasks.register("mainTask").get()

      // Add inputs
      val javaSource = java.io.File("$workspaceRoot/src/Main.java") // Not ignored
      val compiledClass =
          java.io.File("$workspaceRoot/dist/production/Main.class") // Ignored (dist directory)
      val jarTarget = java.io.File("$workspaceRoot/dist/app.jar") // Ignored (dist directory)

      mainTask.inputs.files(javaSource, compiledClass, jarTarget)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier,
          )

      assertNotNull(result)

      assertTrue(result!!.any { it == "{projectRoot}/src/Main.java" })

      // Both ignored files should be consolidated into glob patterns by extension
      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })

      assertTrue(result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar" })
    }
  }

  @Test
  fun `test processTask uses getDependsOnTask efficiently`() {
    val project = ProjectBuilder.builder().withName("testProject").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val dependentTask = project.tasks.register("compile").get()
    val outputFile = java.io.File("${project.rootDir.path}/build/classes/Main.class")
    dependentTask.outputs.file(outputFile)

    val mainTask = project.tasks.register("test").get()
    mainTask.dependsOn(dependentTask)
    mainTask.description = "Run tests"

    // Add inputs
    val inputFile = java.io.File("${project.rootDir.path}/src/test.kt")
    mainTask.inputs.files(inputFile)

    val gitIgnoreClassifier = GitIgnoreClassifier(project.rootDir)
    val result =
        processTask(
            mainTask,
            projectBuildPath = ":testProject",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap(),
            gitIgnoreClassifier = gitIgnoreClassifier,
            project = project,
        )

    assertNotNull(result)

    // Verify basic target properties
    assertEquals("@nx/gradle:gradle", result["executor"])
    assertEquals(true, result["cache"])
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])

    // Same-project dependsOn should be present as object format without projects field
    val dependsOn = result["dependsOn"] as? List<*>
    assertNotNull(dependsOn, "Same-project dependsOn should be present")
    assertTrue(
        dependsOn!!.any { (it as? DependsOnEntry)?.target == "compile" },
        "Expected dependsOn to contain 'compile', got $dependsOn",
    )

    // Verify inputs contain both regular inputs and consolidated dependentTasksOutputFiles
    val inputs = result["inputs"] as? List<*>
    assertNotNull(inputs)
    assertTrue(inputs!!.any { it == "{projectRoot}/src/test.kt" })
    assertTrue(inputs.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })
  }

  @Nested
  inner class ProviderBasedDependenciesTests {

    @Test
    fun `returns empty set when task has no dependencies`() {
      val task = project.tasks.register("standalone").get()
      assertTrue(findProviderBasedDependencies(task).isEmpty())
    }

    @Test
    fun `identifies TaskProvider dependencies`() {
      val producerProvider = project.tasks.register("producer")
      val consumerProvider = project.tasks.register("consumer")
      consumerProvider.configure { it.dependsOn(producerProvider) }

      val result = findProviderBasedDependencies(consumerProvider.get())

      assertTrue(result.any { it.contains("producer") }, "Found: $result")
    }

    @Test
    fun `identifies ProviderInternal from task output files`() {
      val producerProvider =
          project.tasks.register("producer") { task ->
            task.outputs.file(
                java.io.File(project.layout.buildDirectory.asFile.get(), "output.jar")
            )
          }
      val consumerProvider = project.tasks.register("consumer")
      consumerProvider.configure { it.dependsOn(producerProvider.map { p -> p.outputs.files }) }

      val result = findProviderBasedDependencies(consumerProvider.get())

      assertTrue(result.any { it.contains("producer") }, "Found: $result")
    }

    @Test
    fun `identifies ProviderInternal from task output directory`() {
      val compileProvider =
          project.tasks.register("compile") { task ->
            task.outputs.dir(java.io.File(project.layout.buildDirectory.asFile.get(), "classes"))
          }
      val jarProvider = project.tasks.register("jar")
      jarProvider.configure { it.dependsOn(compileProvider.map { p -> p.outputs.files }) }

      val result = findProviderBasedDependencies(jarProvider.get())

      assertTrue(result.any { it.contains("compile") }, "Found: $result")
    }

    @Test
    fun `identifies multiple TaskProvider dependencies`() {
      val provider1 = project.tasks.register("task1")
      val provider2 = project.tasks.register("task2")
      val provider3 = project.tasks.register("task3")

      val consumerProvider = project.tasks.register("consumer")
      consumerProvider.configure { task ->
        task.dependsOn(provider1)
        task.dependsOn(provider2)
        task.dependsOn(provider3)
      }

      val result = findProviderBasedDependencies(consumerProvider.get())

      assertEquals(3, result.size)
      assertTrue(result.any { it.contains("task1") }, "Found: $result")
      assertTrue(result.any { it.contains("task2") }, "Found: $result")
      assertTrue(result.any { it.contains("task3") }, "Found: $result")
    }
  }

  @Nested
  inner class GradleFilesInputsTests {

    @Test
    fun `getGradleFilesInputs returns empty list when no gradle files exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        val result = getGradleFilesInputs(tempDir.path)
        assertTrue(result.isEmpty(), "Expected empty list when no gradle files exist")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns gradle-wrapper files when they exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create gradle wrapper directory and files
        val gradleWrapperDir = java.io.File(tempDir, "gradle/wrapper")
        gradleWrapperDir.mkdirs()
        java.io.File(gradleWrapperDir, "gradle-wrapper.jar").writeBytes(ByteArray(0))
        java.io.File(gradleWrapperDir, "gradle-wrapper.properties").writeText("distributionUrl=...")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(2, result.size, "Expected 2 gradle wrapper files")
        assertTrue(
            result.contains("{workspaceRoot}/gradle/wrapper/gradle-wrapper.jar"),
            "Expected gradle-wrapper.jar in $result",
        )
        assertTrue(
            result.contains("{workspaceRoot}/gradle/wrapper/gradle-wrapper.properties"),
            "Expected gradle-wrapper.properties in $result",
        )
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns gradle properties when it exists`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create only gradle.properties
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(1, result.size, "Expected 1 gradle file")
        assertTrue(
            result.contains("{workspaceRoot}/gradle.properties"),
            "Expected gradle.properties in $result",
        )
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns all gradle files when all exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create all gradle files
        val gradleWrapperDir = java.io.File(tempDir, "gradle/wrapper")
        gradleWrapperDir.mkdirs()
        java.io.File(gradleWrapperDir, "gradle-wrapper.jar").writeBytes(ByteArray(0))
        java.io.File(gradleWrapperDir, "gradle-wrapper.properties").writeText("distributionUrl=...")
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(3, result.size, "Expected 3 gradle files")
        assertTrue(
            result.contains("{workspaceRoot}/gradle/wrapper/gradle-wrapper.jar"),
            "Expected gradle-wrapper.jar",
        )
        assertTrue(
            result.contains("{workspaceRoot}/gradle/wrapper/gradle-wrapper.properties"),
            "Expected gradle-wrapper.properties",
        )
        assertTrue(
            result.contains("{workspaceRoot}/gradle.properties"),
            "Expected gradle.properties",
        )
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getInputsForTask includes gradle files when they exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create gradle.properties only
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        // Create a subproject directory to differentiate projectRoot from workspaceRoot
        val projectDir = java.io.File(tempDir, "app").apply { mkdirs() }
        val project = ProjectBuilder.builder().withProjectDir(projectDir).build()
        val workspaceRoot = tempDir.path
        val projectRoot = projectDir.path

        val mainTask = project.tasks.register("mainTask").get()
        val inputFile = java.io.File("$projectRoot/src/main.kt")
        mainTask.inputs.files(inputFile)

        val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
        val result =
            getInputsForTask(
                null,
                mainTask,
                projectRoot,
                workspaceRoot,
                mutableMapOf(),
                gitIgnoreClassifier,
            )

        assertNotNull(result)
        assertTrue(
            result!!.any { it == "{workspaceRoot}/gradle.properties" },
            "Expected gradle.properties in inputs: $result",
        )
        assertTrue(
            result.any { it == "{projectRoot}/src/main.kt" },
            "Expected src/main.kt in inputs: $result",
        )
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getInputsForTask does not include gradle files when they do not exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Don't create any gradle files
        // Create a subproject directory to differentiate projectRoot from workspaceRoot
        val projectDir = java.io.File(tempDir, "app").apply { mkdirs() }
        val project = ProjectBuilder.builder().withProjectDir(projectDir).build()
        val workspaceRoot = tempDir.path
        val projectRoot = projectDir.path

        val mainTask = project.tasks.register("mainTask").get()
        val inputFile = java.io.File("$projectRoot/src/main.kt")
        mainTask.inputs.files(inputFile)

        val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
        val result =
            getInputsForTask(
                null,
                mainTask,
                projectRoot,
                workspaceRoot,
                mutableMapOf(),
                gitIgnoreClassifier,
            )

        assertNotNull(result)
        // Should have src/main.kt but no gradle files
        assertTrue(
            result!!.any { it == "{projectRoot}/src/main.kt" },
            "Expected src/main.kt in inputs: $result",
        )
        assertFalse(
            result.any { it.toString().contains("gradle") },
            "Did not expect any gradle files in inputs: $result",
        )
      } finally {
        tempDir.deleteRecursively()
      }
    }
  }

  @Nested
  inner class SubprojectNamingTests {

    @Test
    fun `getNxProjectName returns correct name for root and subprojects`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val childDir = java.io.File(appDir, "child").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val childProject =
            ProjectBuilder.builder()
                .withParent(appProject)
                .withProjectDir(childDir)
                .withName("child")
                .build()

        assertEquals("root", getNxProjectName(rootProject))
        assertEquals(":app", getNxProjectName(appProject))
        assertEquals(":app:child", getNxProjectName(childProject))
      } finally {
        rootDir.deleteRecursively()
      }
    }

    @Test
    fun `getDependsOnForTask uses buildTreePath for cross-subproject dependencies`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val libDir = java.io.File(rootDir, "lib").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val libProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(libDir)
                .withName("lib")
                .build()

        java.io.File(appDir, "build.gradle").writeText("// app")
        java.io.File(libDir, "build.gradle").writeText("// lib")

        val libTask = libProject.tasks.register("compileJava").get()
        val appTask = appProject.tasks.register("build").get().apply { dependsOn(libTask) }

        val dependencies = mutableSetOf<Dependency>()
        val dependsOn = getDependsOnForTask(null, appTask, dependencies)

        assertNotNull(dependsOn)
        val libEntry = dependsOn!!.find { it.target == "compileJava" }
        assertNotNull(
            libEntry,
            "Expected dependsOn entry with target 'compileJava' but got $dependsOn",
        )
        assertNotNull(libEntry!!.projects, "Expected 'projects' field for cross-project dependency")
        assertTrue(
            libEntry.projects!!.contains(":lib"),
            "Expected project ':lib' in ${libEntry.projects}",
        )
      } finally {
        rootDir.deleteRecursively()
      }
    }

    @Test
    fun `getDependsOnForTask returns multiple entries for different cross-project targets`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val libDir = java.io.File(rootDir, "lib").apply { mkdirs() }
      val utilDir = java.io.File(rootDir, "util").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val libProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(libDir)
                .withName("lib")
                .build()
        val utilProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(utilDir)
                .withName("util")
                .build()

        java.io.File(appDir, "build.gradle").writeText("// app")
        java.io.File(libDir, "build.gradle").writeText("// lib")
        java.io.File(utilDir, "build.gradle").writeText("// util")

        // Different targets on different projects
        val libClasses = libProject.tasks.register("classes").get()
        val libJar = libProject.tasks.register("jar").get()
        val utilClasses = utilProject.tasks.register("classes").get()

        // app:build depends on lib:classes, lib:jar, and util:classes
        val appTask =
            appProject.tasks.register("build").get().apply {
              dependsOn(libClasses, libJar, utilClasses)
            }

        val dependencies = mutableSetOf<Dependency>()
        val dependsOn = getDependsOnForTask(null, appTask, dependencies)

        assertNotNull(dependsOn, "dependsOn should not be null")
        // Should have 2 entries: "classes" (with lib + util) and "jar" (with lib)
        assertEquals(2, dependsOn!!.size, "Expected 2 dependsOn entries, got $dependsOn")

        val classesEntry = dependsOn.find { it.target == "classes" }
        assertNotNull(classesEntry, "Expected 'classes' target in $dependsOn")
        assertNotNull(classesEntry!!.projects, "Expected projects for classes entry")
        assertTrue(classesEntry.projects!!.contains(":lib"), "Expected :lib in classes projects")
        assertTrue(classesEntry.projects!!.contains(":util"), "Expected :util in classes projects")

        val jarEntry = dependsOn.find { it.target == "jar" }
        assertNotNull(jarEntry, "Expected 'jar' target in $dependsOn")
        assertNotNull(jarEntry!!.projects, "Expected projects for jar entry")
        assertTrue(jarEntry.projects!!.contains(":lib"), "Expected :lib in jar projects")
        assertEquals(1, jarEntry.projects!!.size, "jar should only have 1 project")
      } finally {
        rootDir.deleteRecursively()
      }
    }
  }
}
