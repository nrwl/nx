package dev.nx.gradle.native.data

import org.gradle.api.tasks.Input
import java.io.Serializable

data class ProjectNode(
        @Input
        val targets: NxTargets,

        @Input
        val metadata: NodeMetadata,

        @Input
        val name: String
) : Serializable
