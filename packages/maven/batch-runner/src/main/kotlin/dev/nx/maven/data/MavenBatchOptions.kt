package dev.nx.maven.data

data class MavenBatchOptions(
    val workspaceRoot: String,
    val tasks: Map<String, MavenBatchTask>,
    val args: List<String> = emptyList(),
    val resultsFile: String = "",
    val workspaceDataDirectory: String = "",
    val quiet: Boolean = false,
    val verbose: Boolean = false,
    val taskGraph: String = "{}"
)

data class MavenBatchTask(
    val id: String,
    val phase: String? = null,
    val goals: List<String> = emptyList(),
    val args: List<String> = emptyList(),
    val project: String? = null
)

data class TaskResult(
    val taskId: String,
    val success: Boolean,
    val terminalOutput: String
)
