package dev.nx.gradle.runner

import com.google.gson.Gson
import dev.nx.gradle.data.TaskResult
import java.util.concurrent.ConcurrentHashMap

/**
 * Emits per-task results as `NX_RESULT:{json}` lines on stdout so the Nx batch executor can stream
 * them as an async iterator. Mirrors the Maven runner protocol. Each emit is deduped by task id.
 */
object ResultEmitter {
  private val gson = Gson()
  private val emitted = ConcurrentHashMap.newKeySet<String>()

  fun emit(taskId: String, result: TaskResult) {
    if (!emitted.add(taskId)) return
    val payload =
        mapOf(
            "task" to taskId,
            "result" to
                mapOf(
                    "success" to result.success,
                    "status" to result.status,
                    "startTime" to result.startTime,
                    "endTime" to result.endTime,
                    "terminalOutput" to result.terminalOutput))
    val json = gson.toJson(payload)
    synchronized(System.out) {
      println("NX_RESULT:$json")
      System.out.flush()
    }
  }
}
