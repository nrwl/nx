package dev.nx.gradle

import javax.inject.Inject
import org.gradle.api.Task
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty

/**
 * Extension for Gradle tasks to declare Nx-specific task dependencies.
 *
 * This extension allows Gradle tasks to specify additional dependencies on Nx tasks that are not
 * discoverable through Gradle's standard dependency mechanism.
 *
 * Example usage in Kotlin DSL:
 * ```
 * tasks.named("integrationTest") {
 *   nx {
 *     dependsOn.addAll("^build", "app:lint")
 *   }
 * }
 * ```
 *
 * Example usage in Groovy DSL:
 * ```
 * tasks.named('integrationTest') {
 *   nx.dependsOn.addAll('^build', 'app:lint')
 * }
 * ```
 */
open class NxTaskExtension @Inject constructor(objects: ObjectFactory) {
  /**
   * List of Nx task dependencies for this Gradle task.
   *
   * Supports Nx dependency patterns such as:
   * - "^build" - depends on the 'build' target of all upstream projects
   * - "project:target" - depends on a specific target of a specific project
   * - "target" - depends on a target of the same project
   */
  val dependsOn: ListProperty<String> = objects.listProperty(String::class.java)
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
