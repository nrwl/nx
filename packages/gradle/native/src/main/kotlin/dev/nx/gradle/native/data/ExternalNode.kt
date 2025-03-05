package dev.nx.gradle.native.data

import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Nested
import java.io.Serializable

data class ExternalNode(
        @Input
        var type: String?,

        @Input
        val name: String,

        @Nested
        var data: ExternalDepData
) : Serializable
