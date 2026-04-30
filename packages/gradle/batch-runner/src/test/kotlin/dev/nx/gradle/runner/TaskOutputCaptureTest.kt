package dev.nx.gradle.runner

import java.io.ByteArrayOutputStream
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class TaskOutputCaptureTest {

  private fun capture() = TaskOutputCapture(ByteArrayOutputStream())

  @Test
  fun `routes bytes into the buffer for the most recent header`() {
    val c = capture()
    c.write("> Task :proj:foo\nfoo body\n> Task :proj:bar\nbar body\n".toByteArray())

    assertEquals("> Task :proj:foo\nfoo body", c.getOutput(":proj:foo"))
    assertEquals("> Task :proj:bar\nbar body", c.getOutput(":proj:bar"))
  }

  @Test
  fun `bytes before any header are dropped`() {
    val c = capture()
    c.write("orphan line\n> Task :proj:foo\nfoo body\n".toByteArray())

    assertEquals("> Task :proj:foo\nfoo body", c.getOutput(":proj:foo"))
  }

  @Test
  fun `mirrors writes to the downstream stream`() {
    val downstream = ByteArrayOutputStream()
    val c = TaskOutputCapture(downstream)
    c.write("> Task :proj:foo\nfoo body\n".toByteArray())

    assertEquals("> Task :proj:foo\nfoo body\n", downstream.toString("UTF-8"))
  }

  @Test
  fun `getOutput returns empty for unknown task`() {
    val c = capture()
    c.write("> Task :proj:foo\nfoo body\n".toByteArray())

    assertEquals("", c.getOutput(":proj:unknown"))
  }

  @Test
  fun `getOutput strips trailing scheduling preamble for the next task`() {
    val c = capture()
    c.write(
        ("> Task :proj:foo\n" +
                "foo body\n" +
                "Resolve mutations for :proj:bar (Thread[#1,worker,5,main]) started.\n" +
                ":proj:bar (Thread[#1,worker,5,main]) started.\n")
            .toByteArray())

    val foo = c.getOutput(":proj:foo")
    assertTrue(foo.contains("foo body"))
    assertFalse(foo.contains("Resolve mutations for :proj:bar"))
    assertFalse(foo.contains(":proj:bar (Thread"))
  }

  @Test
  fun `concatenates duplicate sections for the same task`() {
    val c = capture()
    c.write(("> Task :proj:test\nrunning\n> Task :proj:test\npost-test summary\n").toByteArray())

    val test = c.getOutput(":proj:test")
    assertTrue(test.contains("running"))
    assertTrue(test.contains("post-test summary"))
  }

  @Test
  fun `byte-by-byte writes produce same buffering as bulk write`() {
    val c = capture()
    val payload = "> Task :proj:foo\nbody\n".toByteArray()
    payload.forEach { c.write(it.toInt()) }

    assertEquals("> Task :proj:foo\nbody", c.getOutput(":proj:foo"))
  }

  @Test
  fun `errorSink routes bytes into the current task's buffer`() {
    val c = capture()
    c.write("> Task :proj:foo\n".toByteArray())
    val errSink = c.errorSink()
    errSink.write("error from foo\n".toByteArray())

    assertTrue(c.getOutput(":proj:foo").contains("error from foo"))
  }

  @Test
  fun `errorSink without any header drops bytes`() {
    val c = capture()
    val errSink = c.errorSink()
    errSink.write("orphan error\n".toByteArray())

    assertEquals("", c.getOutput(":proj:foo"))
  }

  @Test
  fun `stripNextTaskPreamble keeps lines referencing the current task`() {
    val input =
        "> Task :proj:foo\n" +
            "Build cache key for task ':proj:foo' is abc\n" +
            "Stored cache entry for task ':proj:foo' with cache key abc"

    assertEquals(input, TaskOutputCapture.stripNextTaskPreamble(input, ":proj:foo"))
  }

  @Test
  fun `stripNextTaskPreamble keeps lines without any task reference`() {
    val input = "> Task :proj:test\nRunning tests\nBUILD SUCCESSFUL in 8s"

    assertEquals(input, TaskOutputCapture.stripNextTaskPreamble(input, ":proj:test"))
  }

  @Test
  fun `stripNextTaskPreamble does not strip on single-segment task references`() {
    val input = "> Task :build\nSome output\nSome other line about :build"

    assertEquals(input, TaskOutputCapture.stripNextTaskPreamble(input, ":build"))
  }

  @Test
  fun `stripNextTaskPreamble returns empty input unchanged`() {
    assertEquals("", TaskOutputCapture.stripNextTaskPreamble("", ":proj:foo"))
  }
}
