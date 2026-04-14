package dev.nx.maven

import com.google.gson.JsonObject
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NxProjectAnalyzerTest {

  @Test
  fun `metadata includes groupId, artifactId, and mavenProject`() {
    val metadata = buildProjectMetadata(
      projectName = "com.example:my-lib",
      groupId = "com.example",
      artifactId = "my-lib",
      targetGroups = JsonObject()
    )

    assertEquals("com.example", metadata.get("groupId").asString)
    assertEquals("my-lib", metadata.get("artifactId").asString)
    assertEquals("com.example:my-lib", metadata.get("mavenProject").asString)
  }

  @Test
  fun `metadata includes technologies and target groups`() {
    val targetGroups = JsonObject()
    targetGroups.add("Maven Phases", com.google.gson.JsonArray().apply { add("build") })

    val metadata = buildProjectMetadata(
      projectName = "com.example:my-lib",
      groupId = "com.example",
      artifactId = "my-lib",
      targetGroups = targetGroups
    )

    val technologies = metadata.getAsJsonArray("technologies")
    assertEquals(1, technologies.size())
    assertEquals("maven", technologies[0].asString)
    assertTrue(metadata.getAsJsonObject("targetGroups").has("Maven Phases"))
  }

  @Test
  fun `tags include groupId and packaging`() {
    val tags = buildProjectTags(groupId = "org.acme", packaging = "jar")

    val tagValues = (0 until tags.size()).map { tags[it].asString }
    assertTrue(tagValues.contains("maven:org.acme"))
    assertTrue(tagValues.contains("maven:jar"))
  }

  @Test
  fun `tags use war packaging`() {
    val tags = buildProjectTags(groupId = "com.example", packaging = "war")

    val tagValues = (0 until tags.size()).map { tags[it].asString }
    assertTrue(tagValues.contains("maven:com.example"))
    assertTrue(tagValues.contains("maven:war"))
  }
}
