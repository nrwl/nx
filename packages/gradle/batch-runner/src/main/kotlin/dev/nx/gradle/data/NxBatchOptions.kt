package dev.nx.gradle.data

data class NxBatchOptions(
    val workspaceRoot: String,
    val tasks: Map<String, GradlewTask>,
    val args: String,
    val quiet: Boolean
)
