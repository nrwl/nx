package dev.nx.maven.targets

import com.google.gson.JsonArray
import com.google.gson.JsonObject

data class NxTarget(
  val executor: String,
  val options: JsonObject?,
  val cache: Boolean,
  val continuous: Boolean,
  var dependsOn: JsonArray? = null,
  var outputs: JsonArray? = null,
  var inputs: JsonArray? = null
) {
  fun toJSON(): JsonObject {
    val node = JsonObject()
    node.addProperty("executor", executor)
    if (options != null) {
      node.add("options", options)
    }
    node.addProperty("cache", cache)
    node.addProperty("continuous", continuous)

    dependsOn?.let { node.add("dependsOn", it) }
    outputs?.let { node.add("outputs", it) }
    inputs?.let { node.add("inputs", it) }

    return node
  }
}
