package dev.nx.gradle.native.data

import org.gradle.api.tasks.Input
import java.io.Serializable

data class ExternalDepData(
        @Input
        val version: String?,

        @Input
        val packageName: String,

        @Input
        val hash: String?
) : Serializable
