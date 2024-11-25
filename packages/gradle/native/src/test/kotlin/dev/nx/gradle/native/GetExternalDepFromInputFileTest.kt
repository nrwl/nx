package dev.nx.gradle.native

import dev.nx.gradle.native.data.ExternalNode
import dev.nx.gradle.native.utils.getExternalDepFromInputFile
import kotlin.test.Test
import org.junit.jupiter.api.Assertions.assertEquals

class GetExternalDepFromInputFileTest {

  /**
   * convert path
   * org.apache.commons/commons-lang3/3.13.0/b7263237aa89c1f99b327197c41d0669707a462e/commons-lang3-3.13.0.jar
   * to external dep: "gradle:commons-lang3-3.13.0": { "type": "gradle", "name": "commons-lang3",
   * "data": { "version": "3.13.0", "packageName": "org.apache.commons.commons-lang3", "hash":
   * "b7263237aa89c1f99b327197c41d0669707a462e",} }
   */
  @Test
  fun testExternalDepFromInputFile() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val result =
        getExternalDepFromInputFile(
            "org.apache.commons/commons-lang3/3.13.0/b7263237aa89c1f99b327197c41d0669707a462e/commons-lang3-3.13.0.jar",
            externalNodes)
    assertEquals(
        externalNodes.toString(),
        "{gradle:commons-lang3-3.13.0=ExternalNode(type=gradle, name=gradle:commons-lang3-3.13.0, data=ExternalDepData(version=3.13.0, packageName=org.apache.commons.commons-lang3, hash=b7263237aa89c1f99b327197c41d0669707a462e))}")
  }
}
