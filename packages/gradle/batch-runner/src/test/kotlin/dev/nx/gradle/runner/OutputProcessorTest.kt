package dev.nx.gradle.runner

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class OutputProcessorTest {

  @Test
  fun `strips trailing lines that reference another task`() {
    val input =
        """
        > Task :proj:compileKotlin
        Stored cache entry for task ':proj:compileKotlin'
        Resolve mutations for :proj:compileJava (Thread[#42,worker,5,main]) started.
        :proj:compileJava (Thread[#42,worker,5,main]) started.
        """
            .trimIndent()

    val cleaned = OutputProcessor.stripNextTaskPreamble(input, ":proj:compileKotlin")

    assertTrue(cleaned.endsWith("Stored cache entry for task ':proj:compileKotlin'"))
    assertFalse(cleaned.contains(":proj:compileJava"))
  }

  @Test
  fun `keeps lines referencing the current task`() {
    val input =
        """
        > Task :proj:compileKotlin
        Build cache key for task ':proj:compileKotlin' is abc
        Stored cache entry for task ':proj:compileKotlin' with cache key abc
        """
            .trimIndent()

    val cleaned = OutputProcessor.stripNextTaskPreamble(input, ":proj:compileKotlin")

    assertEquals(input, cleaned)
  }

  @Test
  fun `keeps lines without any task reference`() {
    val input =
        """
        > Task :proj:test
        Running tests
        BUILD SUCCESSFUL in 8s
        7 actionable tasks: 7 executed
        """
            .trimIndent()

    val cleaned = OutputProcessor.stripNextTaskPreamble(input, ":proj:test")

    assertEquals(input, cleaned)
  }

  @Test
  fun `single-segment task references do not trigger stripping`() {
    // The strip regex requires ≥2 segments. A line like `Some other line about :build` shouldn't
    // be treated as a task reference for stripping purposes.
    val input =
        """
        > Task :build
        Some output
        Some other line about :build
        """
            .trimIndent()

    val cleaned = OutputProcessor.stripNextTaskPreamble(input, ":build")

    assertEquals(input, cleaned)
  }

  @Test
  fun `empty input returns empty`() {
    assertEquals("", OutputProcessor.stripNextTaskPreamble("", ":proj:test"))
  }
}
