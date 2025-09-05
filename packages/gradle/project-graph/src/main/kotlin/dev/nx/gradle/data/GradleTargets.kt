package dev.nx.gradle.data

import java.io.Serializable

typealias NxTarget = MutableMap<String, Any?>

typealias NxTargets = MutableMap<String, NxTarget>

typealias TargetGroup = MutableList<String>

typealias TargetGroups = MutableMap<String, TargetGroup>

data class GradleTargets(
    val targets: NxTargets,
    val targetGroups: TargetGroups,
    var externalNodes: MutableMap<String, ExternalNode>
) : Serializable
