package dev.nx.gradle.data

data class NxBatchOptions(
    val workspaceRoot: String,
    val tasks: Map<String, GradleTask>,
    val args: String,
    val quiet: Boolean,
    val excludeTasks: List<String>
)
