package dev.nx.gradle.native.data

import java.io.Serializable

data class NodeMetadata(
    val targetGroups: TargetGroups,
    val technologies: List<String>,
    val description: String?
) : Serializable
