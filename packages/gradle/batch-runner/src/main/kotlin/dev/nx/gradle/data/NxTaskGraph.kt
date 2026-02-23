package dev.nx.gradle.data

/**
 * Minimal task graph representation for ordering Gradle batch task execution. Only contains the
 * fields needed for dependency-aware scheduling — the full Nx Task/TaskTarget hierarchy is not
 * required because we already have GradleTask per task ID.
 */
data class NxTaskGraph(
    /** Task IDs with no dependencies, ready to execute immediately. */
    val roots: List<String>,
    /** Map of task ID to IDs of tasks it depends on. */
    val dependencies: Map<String, List<String>>,
    /**
     * Map of task ID to IDs of continuous dependency tasks (unused for Gradle, kept for compat).
     */
    val continuousDependencies: Map<String, List<String>> = emptyMap()
)
