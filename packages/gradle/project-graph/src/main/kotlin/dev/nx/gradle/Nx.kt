@file:JvmName("Groovy")

package dev.nx.gradle

import org.gradle.api.Project
import org.gradle.api.Task

/**
 * Groovy-friendly facade for nx configuration.
 *
 * Provides overloaded static methods that Groovy can distinguish based on parameter types. This
 * allows Groovy users to import a single method name and use it for both project and task
 * configuration.
 *
 * Example usage in Groovy:
 * ```groovy
 * import static dev.nx.gradle.Groovy.nx
 *
 * // Project-level configuration
 * nx(project) {
 *     it.set('type', 'application')
 *     it.array('tags', 'api', 'backend')
 * }
 *
 * // Task-level configuration
 * tasks.named('test') {
 *     nx(it) {
 *         it.mergedDependsOn('^build')
 *         it.set('cache', false)
 *     }
 * }
 * ```
 */

/**
 * Configure Nx project-level settings.
 *
 * @param project The Gradle project to configure
 * @param configure The configuration block
 */
@JvmName("nx")
fun nx(project: Project, configure: NxProjectExtension.() -> Unit) {
  project.nx(configure)
}

/**
 * Configure Nx task-level settings.
 *
 * @param task The Gradle task to configure
 * @param configure The configuration block
 */
@JvmName("nx")
fun nx(task: Task, configure: NxTaskExtension.() -> Unit) {
  task.nx(configure)
}
