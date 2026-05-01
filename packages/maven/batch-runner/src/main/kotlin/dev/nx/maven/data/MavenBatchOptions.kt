package dev.nx.maven.data

data class MavenBatchOptions(
    val workspaceRoot: String,
    val taskOptions: Map<String, MavenBatchTask>,
    val args: List<String> = emptyList(),
    val verbose: Boolean = false,
    val taskGraph: TaskGraph? = null
)

data class MavenBatchTask(
    val id: String,
    val phase: String? = null,
    val goals: List<String> = emptyList(),
    val args: List<String> = emptyList(),
    val project: String
)

data class TaskResult(
    val taskId: String,
    val success: Boolean,
    val terminalOutput: String,
    val startTime: Long = 0,
    val endTime: Long = 0
)

/**
 * A representation of the invocation of an Executor
 */
data class Task(
    /**
     * Unique ID
     */
    val id: String,

    /**
     * Details about which project, target, and configuration to run.
     */
    val target: TaskTarget,

    /**
     * Overrides for the configured options of the target
     */
    val overrides: Any,

    /**
     * The outputs the task may produce
     */
    val outputs: List<String>,

    /**
     * Root of the project the task belongs to
     */
    val projectRoot: String? = null,

    /**
     * Hash of the task which is used for caching.
     */
    val hash: String? = null,

    /**
     * Details about the composition of the hash
     */
    val hashDetails: TaskHashDetails? = null,

    /**
     * Unix timestamp of when a Batch Task starts
     */
    val startTime: Long? = null,

    /**
     * Unix timestamp of when a Batch Task ends
     */
    val endTime: Long? = null,

    /**
     * Determines if a given task should be cacheable.
     */
    val cache: Boolean? = null,

    /**
     * Determines if a given task should be parallelizable.
     */
    val parallelism: Boolean,

    /**
     * This denotes if the task runs continuously
     */
    val continuous: Boolean? = null
)

/**
 * Details about which project, target, and configuration to run
 */
data class TaskTarget(
    /**
     * The project for which the task belongs to
     */
    val project: String,

    /**
     * The target name which the task should invoke
     */
    val target: String,

    /**
     * The configuration of the target which the task invokes
     */
    val configuration: String? = null
)

/**
 * Details about the composition of the hash
 */
data class TaskHashDetails(
    /**
     * Command of the task
     */
    val command: String,

    /**
     * Hashes of inputs used in the hash
     */
    val nodes: Map<String, String>,

    /**
     * Hashes of implicit dependencies which are included in the hash
     */
    val implicitDeps: Map<String, String>? = null,

    /**
     * Hash of the runtime environment which the task was executed
     */
    val runtime: Map<String, String>? = null
)

/**
 * Graph of Tasks to be executed
 */
data class TaskGraph(
    /**
     * IDs of Tasks which do not have any dependencies and are thus ready to execute immediately
     */
    val roots: List<String>,

    /**
     * Map of Task IDs to Tasks
     */
    val tasks: Map<String, Task>,

    /**
     * Map of Task IDs to IDs of tasks which the task depends on
     */
    val dependencies: Map<String, List<String>>,

    /**
     * Map of Task IDs to IDs of continuous dependency tasks
     */
    val continuousDependencies: Map<String, List<String>>
)
