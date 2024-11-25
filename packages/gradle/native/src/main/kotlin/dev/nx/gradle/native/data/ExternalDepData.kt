package dev.nx.gradle.native.data

import java.io.Serializable
import org.gradle.api.tasks.Input

data class ExternalDepData(
    @Input val version: String?,
    @Input val packageName: String,
    @Input val hash: String?
) : Serializable
