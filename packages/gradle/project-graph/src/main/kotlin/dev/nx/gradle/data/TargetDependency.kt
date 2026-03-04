package dev.nx.gradle.data

import java.io.Serializable

data class TargetDependency(val projects: String, val target: String) : Serializable