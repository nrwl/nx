package dev.nx.gradle.runner

import com.google.gson.Gson
import com.google.gson.JsonObject
import dev.nx.gradle.data.TaskResult
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.lang.reflect.Field
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class ResultEmitterTest {

  private lateinit var originalOut: PrintStream
  private lateinit var captured: ByteArrayOutputStream

  @BeforeEach
  fun setUp() {
    originalOut = System.out
    captured = ByteArrayOutputStream()
    System.setOut(PrintStream(captured, true, "UTF-8"))
    resetEmittedDedupeSet()
  }

  @AfterEach
  fun tearDown() {
    System.setOut(originalOut)
    resetEmittedDedupeSet()
  }

  @Test
  fun `emits an NX_RESULT line with the expected JSON shape`() {
    ResultEmitter.emit(
        "app:build",
        TaskResult(
            success = true,
            startTime = 100L,
            endTime = 200L,
            terminalOutput = "> Task :app:build UP-TO-DATE"))

    val payloads = parseEmittedPayloads()
    assertEquals(1, payloads.size)
    val payload = payloads.single()
    assertEquals("app:build", payload.get("task").asString)
    val result = payload.getAsJsonObject("result")
    assertEquals(true, result.get("success").asBoolean)
    assertEquals(100L, result.get("startTime").asLong)
    assertEquals(200L, result.get("endTime").asLong)
    assertEquals(
        "> Task :app:build UP-TO-DATE", result.get("terminalOutput").asString)
  }

  @Test
  fun `dedupes repeated emissions for the same task id`() {
    val first = TaskResult(true, 1L, 2L, "first emit")
    val second = TaskResult(false, 3L, 4L, "second emit (should be dropped)")

    ResultEmitter.emit("app:build", first)
    ResultEmitter.emit("app:build", second)

    val payloads = parseEmittedPayloads()
    assertEquals(
        1,
        payloads.size,
        "Second emit for the same taskId should be silently dropped")
    val result = payloads.single().getAsJsonObject("result")
    assertEquals(true, result.get("success").asBoolean)
    assertEquals("first emit", result.get("terminalOutput").asString)
  }

  @Test
  fun `emits separate lines for distinct task ids`() {
    ResultEmitter.emit("app:build", TaskResult(true, 0L, 1L, "a"))
    ResultEmitter.emit("lib:build", TaskResult(false, 0L, 1L, "b"))

    val payloads = parseEmittedPayloads()
    assertEquals(2, payloads.size)
    val taskIds = payloads.map { it.get("task").asString }.toSet()
    assertEquals(setOf("app:build", "lib:build"), taskIds)
  }

  @Test
  fun `each emission ends with a newline so readline can split lines`() {
    ResultEmitter.emit("app:build", TaskResult(true, 0L, 1L, "x"))

    val raw = captured.toString("UTF-8")
    assertTrue(
        raw.endsWith("\n"),
        "Emitted line must end with newline; got: ${raw.toByteArray().toList()}")
    assertTrue(raw.startsWith("NX_RESULT:"))
  }

  /** Parse the captured stdout into the payload object of each NX_RESULT line. */
  private fun parseEmittedPayloads(): List<JsonObject> {
    val gson = Gson()
    return captured
        .toString("UTF-8")
        .lineSequence()
        .filter { it.startsWith("NX_RESULT:") }
        .map { gson.fromJson(it.removePrefix("NX_RESULT:"), JsonObject::class.java) }
        .toList()
  }

  /**
   * Clears the singleton's emitted-task dedupe set between tests so each test
   * starts fresh. ResultEmitter is an `object` (singleton), so without this
   * the dedupe state from one test leaks into the next.
   */
  private fun resetEmittedDedupeSet() {
    val field: Field = ResultEmitter::class.java.getDeclaredField("emitted")
    field.isAccessible = true
    val set = field.get(ResultEmitter) as MutableSet<*>
    set.clear()
  }
}
