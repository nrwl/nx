package dev.nx.gradle.native.data

import java.io.Serializable
import org.gradle.api.tasks.Input

data class ProjectNode(
    @Input val targets: NxTargets,
    @Input val metadata: NodeMetadata,
    @Input val name: String
) : Serializable
