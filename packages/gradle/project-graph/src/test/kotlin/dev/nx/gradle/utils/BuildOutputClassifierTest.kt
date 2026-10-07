package dev.nx.gradle.utils

import java.io.File
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test

class BuildOutputClassifierTest {

  @Test
  fun `files under any project's build directory are build output`() {
    val root = ProjectBuilder.builder().build()
    val lib = ProjectBuilder.builder().withParent(root).withName("lib").build()
    lib.layout.buildDirectory.set(File(lib.projectDir, "out"))

    val classifier = BuildOutputClassifier.forBuild(root)

    assertTrue(classifier.isBuildOutput(File(root.projectDir, "build/classes/Main.class")))
    assertTrue(classifier.isBuildOutput(File(lib.projectDir, "out/libs/lib.jar")))
    assertFalse(classifier.isBuildOutput(File(lib.projectDir, "build/libs/lib.jar")))
    assertFalse(classifier.isBuildOutput(File(root.projectDir, "src/main/java/Main.java")))
    assertFalse(classifier.isBuildOutput(File(root.projectDir, "buildSrc/Main.kt")))
  }

  @Test
  fun `relative and unnormalized paths are resolved first`() {
    val classifier = BuildOutputClassifier(listOf(File("/ws/app/build")))

    assertTrue(classifier.isBuildOutput(File("/ws/app/src/../build/libs/app.jar")))
    assertFalse(classifier.isBuildOutput(File("/ws/app/build-logic/Main.kt")))
  }
}
