package dev.nx.gradle.data

import com.google.gson.annotations.SerializedName

enum class DependsOnParams {
  @SerializedName("forward") FORWARD,
  @SerializedName("ignore") IGNORE,
}

data class DependsOnEntry(
    val target: String,
    val projects: List<String>? = null,
    val params: DependsOnParams? = null,
)
