package dev.nx.gradle.utils

fun includeIgnoredInput(fileset: String): Map<String, Any> =
    mapOf("fileset" to fileset, "includeIgnored" to true)
