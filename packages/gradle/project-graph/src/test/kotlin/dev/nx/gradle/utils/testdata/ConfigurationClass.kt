package dev.nx.gradle.utils.testdata

/** Configuration class that should be excluded from test target generation */
class ConfigurationClass {

  fun testBean(): String {
    return "test"
  }
}

/** Another configuration class */
class AnotherConfigurationClass {

  fun anotherBean(): String {
    return "another"
  }
}
