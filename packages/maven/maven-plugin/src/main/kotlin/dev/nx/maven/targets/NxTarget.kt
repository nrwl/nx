package dev.nx.maven.targets

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode

data class NxTarget(
  val executor: String,
  val options: ObjectNode?,
  val cache: Boolean,
  val continuous: Boolean,
  val parallelism: Boolean,
  var dependsOn: ArrayNode? = null,
  var outputs: ArrayNode? = null,
  var inputs: ArrayNode? = null
) {
  fun toJSON(objectMapper: ObjectMapper): ObjectNode {
    val node = objectMapper.createObjectNode()
    node.put("executor", executor)
    if (options != null) {
      node.set<ObjectNode>("options", options)
    }
    node.put("cache", cache)
    node.put("continuous", continuous)
    node.put("parallelism", parallelism)

    dependsOn?.let { node.set<ObjectNode>("dependsOn", it) }
    outputs?.let { node.set<ObjectNode>("outputs", it) }
    inputs?.let { node.set<ObjectNode>("inputs", it) }

    return node
  }
}
