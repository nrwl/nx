package dev.nx.gradle.native.data

import java.io.Serializable

data class Dependency(val source: String, val target: String, var sourceFile: String) :
    Serializable
