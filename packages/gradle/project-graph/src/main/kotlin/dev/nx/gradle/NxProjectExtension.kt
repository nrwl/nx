package dev.nx.gradle

import dev.nx.gradle.dsl.NxArrayBuilder
import dev.nx.gradle.dsl.NxObjectBuilder
import dev.nx.gradle.dsl.asJson
import dev.nx.gradle.dsl.asJsonMap
import javax.inject.Inject
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.MapProperty

/**
 * Extension for Gradle projects to declare Nx-specific project metadata.
 *
 * This extension allows Gradle projects to specify project-level metadata such as name, tags, and
 * description. The configuration is exposed as JSON that Nx will process later.
 *
 * Note: This is ONLY for project-level metadata. Targets are automatically discovered from Gradle
 * tasks and should NOT be defined here.
 *
 * Example usage in Kotlin DSL:
 * ```
 * nx {
 *   set("name", "my-project")
 *   array("tags", "service:payments", "tier:2")
 *   set("description", "Payment processing service")
 * }
 * ```
 *
 * Example usage in Groovy DSL:
 * ```
 * nx {
 *   set 'name', 'my-project'
 *   array 'tags', 'service:payments', 'tier:2'
 *   set 'description', 'Payment processing service'
 * }
 * ```
 */
open class NxProjectExtension @Inject constructor(objects: ObjectFactory) {
  /** JSON root for project-level Nx config */
  val json: MapProperty<String, Any?> = objects.mapProperty(String::class.java, Any::class.java)

  // DSL methods for building JSON config

  fun set(key: String, value: String) = json.put(key, value)

  fun set(key: String, value: Number) = json.put(key, value)

  fun set(key: String, value: Boolean) = json.put(key, value)

  fun set(key: String, block: NxObjectBuilder.() -> Unit) {
    val obj = NxObjectBuilder().apply(block).content
    json.put(key, obj)
  }

  fun set(key: String, action: Action<NxObjectBuilder>) = set(key) { action.execute(this) }

  fun array(key: String, vararg values: Any?) = json.put(key, values.map { asJson(it) })

  fun array(key: String, values: Iterable<*>) = json.put(key, values.map { asJson(it) })

  fun array(key: String, block: NxArrayBuilder.() -> Unit) {
    val arr = NxArrayBuilder().apply(block).content
    json.put(key, arr)
  }

  fun merge(map: Map<String, Any?>) = json.putAll(asJsonMap(map))
}

/**
 * Type-safe accessor for the nx extension in Kotlin DSL at project level.
 *
 * Example:
 * ```
 * nx {
 *   set("name", "my-project")
 *   array("tags", "service", "backend")
 * }
 * ```
 */
fun Project.nx(configure: NxProjectExtension.() -> Unit) {
  val extension =
      extensions.findByType(NxProjectExtension::class.java)
          ?: throw IllegalStateException(
              "NxProjectExtension not found on project '${this.name}'. " +
                  "Make sure the dev.nx.gradle.project-graph plugin is applied.")
  configure(extension)
}
