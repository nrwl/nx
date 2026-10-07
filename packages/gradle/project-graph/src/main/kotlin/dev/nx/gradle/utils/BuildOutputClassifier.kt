package dev.nx.gradle.utils

import java.io.File
import java.util.Collections
import java.util.WeakHashMap
import org.gradle.api.Project
import org.gradle.api.invocation.Gradle
import org.gradle.internal.composite.IncludedBuildInternal

/**
 * Tells build output apart from sources by location: a file is build output when it lives under a
 * project's build directory, in this build or an included one.
 */
class BuildOutputClassifier(buildDirs: Collection<File>) {
  private val buildDirs = buildDirs.map { it.absoluteFile.normalize() }.toSet()

  fun isBuildOutput(file: File): Boolean =
      generateSequence(file.absoluteFile.normalize()) { it.parentFile }.any { it in buildDirs }

  companion object {
    private val byBuild: MutableMap<Gradle, BuildOutputClassifier> =
        Collections.synchronizedMap(WeakHashMap())

    fun forBuild(project: Project): BuildOutputClassifier =
        byBuild.getOrPut(project.gradle) { BuildOutputClassifier(buildDirsOf(project)) }

    private fun buildDirsOf(project: Project): Set<File> {
      val dirs = mutableSetOf<File>()
      project.rootProject.allprojects.forEach { dirs.add(it.layout.buildDirectory.get().asFile) }
      project.gradle.includedBuilds.forEach { included ->
        try {
          (included as IncludedBuildInternal).target.mutableModel.rootProject.allprojects.forEach {
            dirs.add(it.layout.buildDirectory.get().asFile)
          }
        } catch (t: Throwable) {
          // Not configured yet: assume the default build directory.
          dirs.add(File(included.projectDir, "build"))
        }
      }
      return dirs
    }
  }
}
