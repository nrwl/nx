package dev.nx.gradle.native.data

import java.io.Serializable
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Nested

data class ExternalNode(
    @Input var type: String?,
    @Input val name: String,
    @Nested var data: ExternalDepData
) : Serializable
