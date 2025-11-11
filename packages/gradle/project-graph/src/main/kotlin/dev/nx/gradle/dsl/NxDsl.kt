package dev.nx.gradle.dsl

@DslMarker annotation class NxDslMarker

// --- JSON adapters (restrict to JSON-friendly types) ---

internal fun asJson(value: Any?): Any? =
    when (value) {
      null -> null
      is String,
      is Number,
      is Boolean -> value
      is Map<*, *> -> value.entries.associate { it.key.toString() to asJson(it.value) }
      is Iterable<*> -> value.map { asJson(it) }
      is Array<*> -> value.map { asJson(it) }
      is Enum<*> -> value.name
      else ->
          throw IllegalArgumentException(
              "Unsupported JSON value type: ${value::class.qualifiedName}")
    }

internal fun asJsonMap(map: Map<String, *>): Map<String, Any?> =
    map.mapValues { (_, v) -> asJson(v) }

// --- Builders ---

@NxDslMarker
class NxObjectBuilder internal constructor() {
  internal val content = linkedMapOf<String, Any?>()

  // Scalars
  fun set(key: String, value: String) {
    content[key] = value
  }

  fun set(key: String, value: Number) {
    content[key] = value
  }

  fun set(key: String, value: Boolean) {
    content[key] = value
  }

  fun setNull(key: String) {
    content[key] = null
  }

  // Nested object
  fun set(key: String, block: NxObjectBuilder.() -> Unit) {
    val child = NxObjectBuilder().apply(block)
    content[key] = child.content
  }

  // Arrays
  fun array(key: String, vararg values: Any?) {
    content[key] = values.map { asJson(it) }
  }

  fun array(key: String, values: Iterable<*>) {
    content[key] = values.map { asJson(it) }
  }

  fun array(key: String, block: NxArrayBuilder.() -> Unit) {
    val arr = NxArrayBuilder().apply(block)
    content[key] = arr.content
  }

  // Bulk
  fun merge(map: Map<String, Any?>) {
    content.putAll(asJsonMap(map))
  }
}

@NxDslMarker
class NxArrayBuilder internal constructor() {
  internal val content = arrayListOf<Any?>()

  fun add(value: String) {
    content += value
  }

  fun add(value: Number) {
    content += value
  }

  fun add(value: Boolean) {
    content += value
  }

  fun addNull() {
    content += null
  }

  fun addAll(values: Iterable<*>) {
    content.addAll(values.map { asJson(it) })
  }

  fun obj(block: NxObjectBuilder.() -> Unit) {
    content += NxObjectBuilder().apply(block).content
  }
}
