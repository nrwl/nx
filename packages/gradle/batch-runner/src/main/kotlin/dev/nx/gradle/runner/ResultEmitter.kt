package dev.nx.gradle.runner

import com.google.gson.Gson
import dev.nx.gradle.data.TaskResult
import java.util.concurrent.ConcurrentHashMap

/**
 * Emits per-task results to stdout as `NX_RESULT:{json}` lines so the Nx batch executor can stream
 * them to the task runner as an async iterator instead of waiting for a bulk JSON blob at the end.
 *
 * Matches the protocol used by the Maven batch runner.
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
