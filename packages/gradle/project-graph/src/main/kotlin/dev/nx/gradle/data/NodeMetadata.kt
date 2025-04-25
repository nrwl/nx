package dev.nx.gradle.data

import java.io.Serializable

data class NodeMetadata(
    val targetGroups: TargetGroups,
    val technologies: List<String>,
    val description: String?
) : Serializable
