package dev.nx.gradle.runner

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
  }

  @Nested
  inner class SplitOutputPerTaskDirectTests {

    @Test
    fun `splits two adjacent task sections by header`() {
      val global =
          """
          > Task :proj:compileKotlin
          Build cache key for task ':proj:compileKotlin' is abc
          Stored cache entry for task ':proj:compileKotlin'
          > Task :proj:test
          Running tests
          BUILD SUCCESSFUL
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      assertEquals(setOf(":proj:compileKotlin", ":proj:test"), sections.keys)
      assertTrue(sections[":proj:compileKotlin"]!!.contains("Stored cache entry for task"))
      assertTrue(sections[":proj:test"]!!.contains("Running tests"))
      assertTrue(sections[":proj:test"]!!.contains("BUILD SUCCESSFUL"))
    }

    @Test
    fun `strips trailing scheduling preamble for the next task`() {
      val global =
          """
          > Task :proj:compileKotlin
          Stored cache entry for task ':proj:compileKotlin'
          Resolve mutations for :proj:compileJava (Thread[#42,Execution worker,5,main]) started.
          :proj:compileJava (Thread[#42,Execution worker,5,main]) started.
          > Task :proj:compileJava
          Compilation output
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val compileKotlin = sections[":proj:compileKotlin"]!!
      assertTrue(
          compileKotlin.contains("Stored cache entry for task ':proj:compileKotlin'"),
          "kept legit own-task content")
      assertFalse(
          compileKotlin.contains("Resolve mutations for :proj:compileJava"),
          "stripped 'Resolve mutations' for next task")
      assertFalse(
          compileKotlin.contains(":proj:compileJava (Thread"),
          "stripped ':next (Thread …) started.' for next task")
    }

    @Test
    fun `does not strip trailing lines that reference the current task`() {
      val global =
          """
          > Task :proj:compileKotlin
          Build cache key for task ':proj:compileKotlin' is abc
          Stored cache entry for task ':proj:compileKotlin' with cache key abc
          > Task :proj:test
          Running tests
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val compileKotlin = sections[":proj:compileKotlin"]!!
      assertTrue(
          compileKotlin.endsWith(
              "Stored cache entry for task ':proj:compileKotlin' with cache key abc"),
          "current-task references must be preserved")
    }

    @Test
    fun `does not strip trailing lines without any task reference`() {
      val global =
          """
          > Task :proj:test
          Running tests
          BUILD SUCCESSFUL in 8s
          7 actionable tasks: 7 executed
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val test = sections[":proj:test"]!!
      assertTrue(test.endsWith("7 actionable tasks: 7 executed"))
    }

    @Test
    fun `strips multiple stacked preamble lines`() {
      val global =
          """
          > Task :proj:javadocJar UP-TO-DATE
          Caching disabled for task ':proj:javadocJar' because:
            Not worth caching
          Skipping task ':proj:javadocJar' as it is up-to-date.
          Resolve mutations for :proj:processTestResources (Thread[#1,worker,5,main]) started.
          :proj:processTestResources (Thread[#1,worker,5,main]) started.
          > Task :proj:processTestResources
          Processing
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val javadocJar = sections[":proj:javadocJar"]!!
      assertTrue(javadocJar.endsWith("Skipping task ':proj:javadocJar' as it is up-to-date."))
      assertFalse(javadocJar.contains("Resolve mutations for :proj:processTestResources"))
      assertFalse(javadocJar.contains(":proj:processTestResources (Thread"))
    }

    @Test
    fun `keeps single-segment task references intact`() {
      // The strip regex requires ≥2 segments (e.g. :proj:foo). Single-segment ":foo" references
      // shouldn't trigger stripping — that would risk false positives on short paths or
      // colon-prefixed tokens that happen to look like task names.
      val global =
          """
          > Task :build
          Some output
          Some other line about :build
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val build = sections[":build"]!!
      assertTrue(build.contains("Some output"))
      assertTrue(build.contains("Some other line about :build"))
    }

    @Test
    fun `last section has no successor preamble to strip`() {
      // The last task in the build has no successor task printing preamble — its trailing
      // content is build-summary lines like "BUILD SUCCESSFUL" which contain no task refs.
      val global =
          """
          > Task :proj:compileKotlin
          Compilation done
          > Task :proj:test
          Tests done

          BUILD SUCCESSFUL in 3s
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      assertTrue(sections[":proj:test"]!!.contains("Tests done"))
      assertTrue(sections[":proj:test"]!!.contains("BUILD SUCCESSFUL in 3s"))
    }

    @Test
    fun `concatenates duplicate sections for the same task`() {
      // Gradle re-emits "> Task :foo:test" before its post-test summary section. Both chunks
      // belong to :foo:test and should be present in the final section.
      val global =
          """
          > Task :proj:test
          Running tests

          > Task :proj:test
          Finished generating test XML results
          Stored cache entry for task ':proj:test'
          """
              .trimIndent()

      val sections = OutputProcessor.splitOutputPerTask(global)

      val test = sections[":proj:test"]!!
      assertTrue(test.contains("Running tests"))
      assertTrue(test.contains("Finished generating test XML results"))
      assertTrue(test.contains("Stored cache entry for task ':proj:test'"))
    }
  }
}
