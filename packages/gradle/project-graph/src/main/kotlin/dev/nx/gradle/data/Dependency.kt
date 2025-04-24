package dev.nx.gradle.data

import java.io.Serializable

data class Dependency(val source: String, val target: String, var sourceFile: String) :
    Serializable
