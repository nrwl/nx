package dev.nx.gradle

import dev.nx.gradle.dsl.NxArrayBuilder
import dev.nx.gradle.dsl.NxObjectBuilder
import dev.nx.gradle.dsl.asJson
import dev.nx.gradle.dsl.asJsonMap
import javax.inject.Inject
import org.gradle.api.Action
import org.gradle.api.Task
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.MapProperty

/**
 * Extension for Gradle tasks to declare Nx-specific task configuration.
 *
 * This extension allows Gradle tasks to specify additional Nx metadata including:
 * - Task dependencies (via dependsOn property)
 * - Any Nx target properties (via JSON DSL)
 *
 * Example usage in Kotlin DSL:
 * ```
 * tasks.named("integrationTest") {
 *   nx {
 *     dependsOn.addAll("^build", "app:lint")
 *     set("cache", false)
 *     array("tags", "integration", "slow")
 *     set("metadata") {
 *       set("description", "Run integration tests")
 *       set("priority", 1)
 *     }
 *   }
 * }
 * ```
 *
 * Example usage in Groovy DSL:
 * ```
 * tasks.named('integrationTest') {
 *   nx {
 *     dependsOn.addAll('^build', 'app:lint')
 *     set 'cache', false
 *     array 'tags', 'integration', 'slow'
 *   }
 * }
 * ```
 */
open class NxTaskExtension @Inject constructor(objects: ObjectFactory) {
  /**
   * List of Nx task dependencies for this Gradle task.
   *
   * **IMPORTANT: This property merges with Gradle-detected dependencies.** Using this ListProperty
   * will ADD to dependencies that Gradle already detected, whereas using `set("dependsOn", ...)` in
   * the JSON DSL will REPLACE all dependencies.
   *
   * Supports Nx dependency patterns such as:
   * - "^build" - depends on the 'build' target of all upstream projects
   * - "project:target" - depends on a specific target of a specific project
   * - "target" - depends on a target of the same project
   *
   * Example - MERGES with Gradle dependencies (recommended):
   * ```kotlin
   * tasks.named("integrationTest") {
   *   nx {
   *     dependsOn.addAll("^build", "app:lint")  // Adds to Gradle dependencies
   *   }
   * }
   * ```
   */
  val dependsOn: ListProperty<String> = objects.listProperty(String::class.java)

  /** JSON root for task-level Nx config */
  val json: MapProperty<String, Any?> = objects.mapProperty(String::class.java, Any::class.java)

  // DSL methods for building JSON config

  fun set(key: String, value: String) = json.put(key, value)

  fun set(key: String, value: Number) = json.put(key, value)

  fun set(key: String, value: Boolean) = json.put(key, value)

  fun setNull(key: String) = json.put(key, null as Any?)

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
 * Type-safe accessor for the nx extension in Kotlin DSL.
 *
 * Example:
 * ```
 * tasks.named("test") {
 *   nx {
 *     dependsOn.add("^build")
 *   }
 * }
 * ```
 */
fun Task.nx(configure: NxTaskExtension.() -> Unit) {
  val extension =
      extensions.findByType(NxTaskExtension::class.java)
          ?: throw IllegalStateException(
              "NxTaskExtension not found on task '${this.name}'. " +
                  "Make sure the dev.nx.gradle.project-graph plugin is applied.")
  configure(extension)
}
