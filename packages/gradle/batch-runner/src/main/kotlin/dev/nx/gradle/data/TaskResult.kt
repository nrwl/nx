package dev.nx.gradle.data

/**
 * Per-task result emitted over NX_RESULT. `status` is always sent — one of `"success"`,
 * `"failure"`, or `"skipped"`. `success` is also sent for back-compat with Nx versions that don't
 * read `status` yet.
 */
data class TaskResult(
    val success: Boolean,
    val status: String,
    val startTime: Long,
    val endTime: Long,
    var terminalOutput: String,
) {
  companion object {
    fun success(startTime: Long, endTime: Long, terminalOutput: String) =
        TaskResult(true, "success", startTime, endTime, terminalOutput)

    fun failure(startTime: Long, endTime: Long, terminalOutput: String) =
        TaskResult(false, "failure", startTime, endTime, terminalOutput)

    fun skipped(startTime: Long, endTime: Long) =
        TaskResult(false, "skipped", startTime, endTime, "")

    fun fromBoolean(
        success: Boolean,
        startTime: Long,
        endTime: Long,
        terminalOutput: String,
    ): TaskResult =
        if (success) success(startTime, endTime, terminalOutput)
        else failure(startTime, endTime, terminalOutput)
  }
}
