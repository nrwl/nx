package dev.nx.gradle.utils.testdata

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** Configuration class that should be excluded from test target generation */
@TestConfiguration
class ConfigurationClass {

  @Bean
  fun testBean(): String {
    return "test"
  }
}

/** Another configuration class */
@Configuration
class AnotherConfigurationClass {

  @Bean
  fun anotherBean(): String {
    return "another"
  }
}
