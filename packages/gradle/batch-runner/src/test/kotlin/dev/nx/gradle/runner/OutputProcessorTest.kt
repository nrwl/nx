package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import java.io.ByteArrayOutputStream
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class OutputProcessorTest {

  @Nested
  inner class BuildTerminalOutputTests {

    @Test
    fun `returns only stdout when stderr is empty`() {
      val stdOut = ByteArrayOutputStream()
      stdOut.write("Standard output only".toByteArray())

      val stdErr = ByteArrayOutputStream()

      val result = OutputProcessor.buildTerminalOutput(stdOut, stdErr)

      assertEquals("Standard output only\n", result)
    }

    @Test
    fun `returns only stderr when stdout is empty`() {
      val stdOut = ByteArrayOutputStream()

      val stdErr = ByteArrayOutputStream()
      stdErr.write("Error only".toByteArray())

      val result = OutputProcessor.buildTerminalOutput(stdOut, stdErr)

      assertEquals("Error only", result)
    }

    @Test
    fun `returns empty string when both streams are empty`() {
      val stdOut = ByteArrayOutputStream()
      val stdErr = ByteArrayOutputStream()

      val result = OutputProcessor.buildTerminalOutput(stdOut, stdErr)

      assertEquals("", result)
    }

    @Test
    fun `handles multiline output in stdout`() {
      val stdOut = ByteArrayOutputStream()
      stdOut.write("Line 1\nLine 2\nLine 3".toByteArray())

      val stdErr = ByteArrayOutputStream()

      val result = OutputProcessor.buildTerminalOutput(stdOut, stdErr)

      assertEquals("Line 1\nLine 2\nLine 3\n", result)
    }

    @Nested
    inner class FinalizeTaskResultsTests {

      @Test
      fun `assigns task-specific output to task results`() {
        val tasks =
            mapOf(
                "task1" to GradleTask(taskName = ":project:build"),
                "task2" to GradleTask(taskName = ":project:test"))

        val taskResults = mutableMapOf<String, TaskResult>()

        val globalOutput =
            """
            > Task :project:build
            Build output here
            > Task :project:test
            Test output here
            """
                .trimIndent()

        val errorStream = ByteArrayOutputStream()
        val startTime = 1000L
        val endTime = 2000L

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, startTime, endTime)

        assertEquals(2, result.size)
        assertTrue(result["task1"]!!.terminalOutput.contains("Build output here"))
        assertTrue(result["task2"]!!.terminalOutput.contains("Test output here"))
      }

      @Test
      fun `uses global output when task-specific output is not found`() {
        val tasks = mapOf("task1" to GradleTask(taskName = ":project:unknown"))

        val taskResults = mutableMapOf<String, TaskResult>()

        val globalOutput = "Global build output without task headers"

        val errorStream = ByteArrayOutputStream()

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

        assertEquals(globalOutput, result["task1"]!!.terminalOutput)
      }

      @Test
      fun `appends error stream to failed task output`() {
        val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

        val existingResult =
            TaskResult(success = false, startTime = 1000L, endTime = 2000L, terminalOutput = "")
        val taskResults = mutableMapOf("task1" to existingResult)

        val globalOutput = "> Task :project:build\nBuild output"

        val errorStream = ByteArrayOutputStream()
        errorStream.write("Error details".toByteArray())

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

        val output = result["task1"]!!.terminalOutput
        assertTrue(output.contains("Build output"))
        assertTrue(output.contains("Error details"))
      }

      @Test
      fun `creates new task result when task result does not exist`() {
        val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

        val taskResults = mutableMapOf<String, TaskResult>()

        val globalOutput = "> Task :project:build\nBuild output"

        val errorStream = ByteArrayOutputStream()
        val startTime = 1000L
        val endTime = 2000L

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, startTime, endTime)

        assertEquals(1, result.size)
        assertNotNull(result["task1"])
        assertEquals(false, result["task1"]!!.success)
        assertEquals(startTime, result["task1"]!!.startTime)
        assertEquals(endTime, result["task1"]!!.endTime)
      }

      @Test
      fun `preserves existing task result properties when updating`() {
        val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

        val existingResult =
            TaskResult(
                success = true, startTime = 500L, endTime = 1500L, terminalOutput = "old output")
        val taskResults = mutableMapOf("task1" to existingResult)

        val globalOutput = "> Task :project:build\nNew build output"

        val errorStream = ByteArrayOutputStream()

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

        assertEquals(true, result["task1"]!!.success)
        assertEquals(500L, result["task1"]!!.startTime)
        assertEquals(1500L, result["task1"]!!.endTime)
        assertTrue(result["task1"]!!.terminalOutput.contains("New build output"))
      }

      @Test
      fun `handles multiple tasks with mixed task names`() {
        val tasks =
            mapOf(
                "task1" to GradleTask(taskName = ":app:compileKotlin"),
                "task2" to GradleTask(taskName = ":lib:test"),
                "task3" to GradleTask(taskName = ":app:build"))

        val taskResults = mutableMapOf<String, TaskResult>()

        val globalOutput =
            """
            > Task :app:compileKotlin
            Compiling Kotlin sources
            > Task :lib:test
            Running tests
            > Task :app:build
            Building application
            """
                .trimIndent()

        val errorStream = ByteArrayOutputStream()

        val result =
            OutputProcessor.finalizeTaskResults(
                tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

        assertEquals(3, result.size)
        assertTrue(result["task1"]!!.terminalOutput.contains("Compiling Kotlin sources"))
        assertTrue(result["task2"]!!.terminalOutput.contains("Running tests"))
        assertTrue(result["task3"]!!.terminalOutput.contains("Building application"))
      }

      @Nested
      inner class SplitOutputPerTaskTests {

        @Test
        fun `parses basic task output`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :project:build
              Build succeeded
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("> Task :project:build"))
          assertTrue(output.contains("Build succeeded"))
        }

        @Test
        fun `handles escaped unicode characters in task header`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput = "\\u003e Task :project:build\\nBuild output"

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("> Task :project:build"))
          assertTrue(output.contains("Build output"))
        }

        @Test
        fun `parses task with status markers`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:compileKotlin"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :project:compileKotlin UP-TO-DATE
              Task is up to date
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("> Task :project:compileKotlin"))
        }

        @Test
        fun `handles multiple task headers with same task name`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :project:build
              First execution
              > Task :project:build
              Second execution
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("First execution"))
          assertTrue(output.contains("Second execution"))
        }

        @Test
        fun `parses nested project task names`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":libs:shared:utils:compileKotlin"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :libs:shared:utils:compileKotlin
              Compiling nested project
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          assertTrue(result["task1"]!!.terminalOutput.contains("Compiling nested project"))
        }

        @Test
        fun `parses task output with build cache information`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:compileKotlin"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :project:compileKotlin
              Build cache key for task ':project:compileKotlin' is 1620a628b99d7592110291bd987d71a0
              Task ':project:compileKotlin' is not up-to-date because:
                Executed with '--rerun-tasks'.
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("Build cache key"))
          assertTrue(output.contains("not up-to-date"))
        }

        @Test
        fun `handles daemon startup messages before task output`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":project:build"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              The client will now receive all logging from the daemon (pid: 40783).
              Starting 11th build in daemon [uptime: 42 mins 52.119 secs, performance: 99%]
              Using 6 worker leases.
              > Task :project:build
              Build output
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val output = result["task1"]!!.terminalOutput
          assertTrue(output.contains("> Task :project:build"))
          assertTrue(output.contains("Build output"))
        }

        @Test
        fun `separates output for different tasks correctly`() {
          val tasks =
              mapOf(
                  "task1" to GradleTask(taskName = ":app:compileKotlin"),
                  "task2" to GradleTask(taskName = ":app:test"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :app:compileKotlin
              Compiling sources
              w: Some warning
              > Task :app:test
              Running tests
              Test passed
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          val compileOutput = result["task1"]!!.terminalOutput
          val testOutput = result["task2"]!!.terminalOutput

          assertTrue(compileOutput.contains("Compiling sources"))
          assertTrue(compileOutput.contains("Some warning"))
          assertFalse(compileOutput.contains("Running tests"))

          assertTrue(testOutput.contains("Running tests"))
          assertTrue(testOutput.contains("Test passed"))
          assertFalse(testOutput.contains("Compiling sources"))
        }

        @Test
        fun `handles task names with special characters`() {
          val tasks = mapOf("task1" to GradleTask(taskName = ":my-app:compile-java"))

          val taskResults = mutableMapOf<String, TaskResult>()

          val globalOutput =
              """
              > Task :my-app:compile-java
              Compilation output
              """
                  .trimIndent()

          val errorStream = ByteArrayOutputStream()

          val result =
              OutputProcessor.finalizeTaskResults(
                  tasks, taskResults, globalOutput, errorStream, 1000L, 2000L)

          assertTrue(result["task1"]!!.terminalOutput.contains("Compilation output"))
        }
      }
    }
  }
}
