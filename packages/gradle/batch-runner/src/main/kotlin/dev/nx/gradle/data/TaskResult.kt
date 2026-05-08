package dev.nx.gradle.data

/**
 * Per-task result emitted by the batch runner over NX_RESULT.
 *
 * `status` is the authoritative outcome consumed by Nx:
 * - `"success"`: the task ran and succeeded.
 * - `"failure"`: the task ran and failed.
 * - `"skipped"`: the task did not run (e.g. a peer task in the same batch
 *   failed and Gradle aborted before this task could be scheduled).
 *
 * `success` is kept on the wire for backward compatibility with older Nx
 * versions that don't read `status` yet — newer Nx prefers `status`.
 */
data class TaskResult(
    val success: Boolean,
    val startTime: Long,
    val endTime: Long,
    var terminalOutput: String,
    val status: String = if (success) "success" else "failure",
)
