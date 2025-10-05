package dev.nx.gradle.data

data class TaskResult(
    val success: Boolean,
    val startTime: Long,
    val endTime: Long,
    var terminalOutput: String
)
