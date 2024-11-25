package dev.nx.gradle.native.data

import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Nested
import java.io.Serializable

data class GradleNodeReport(
        @Nested
        val nodes: Map<String, ProjectNode>,

        @Input
        val dependencies: Set<Dependency>,

        @Nested
        val externalNodes: Map<String, ExternalNode>
) : Serializable
