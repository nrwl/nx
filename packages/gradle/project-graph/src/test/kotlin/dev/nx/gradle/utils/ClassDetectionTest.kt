package dev.nx.gradle.utils

import java.io.File
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ClassDetectionTest {
  @Test
  fun `detects top-level and annotated nested classes only`() {
    val kotlinSource =
        """
            import some.package
            
            package real.package
            
            class ClassA {
              @Test fun testMethod() {}
              
              @Nested
              class ClassB {
                @Test fun testMethod() {}
              }

              class ClassC

              private class ClassD
            }

            internal class ClassU {
              @Test fun testMethod() {}
            }

            public abstract class ClassV
            
            @Nested
            class ClassX // not nested — should be ignored

            private class ClassY

            class ClassZ {
              @Test fun testMethod() {}
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("ClassDetectionTest", ".kt")
    tempFile.writeText(kotlinSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output
    val expected =
        mapOf("ClassAClassB" to "real.package.ClassA\$ClassB", "ClassZ" to "real.package.ClassZ")

    assertEquals(expected, result)
  }

  @Test
  fun `detects top-level and annotated nested classes only with package name`() {
    val kotlinSource =
        """
            package dev.test
            class ClassA {
              @Test fun testMethod() {}
              
              @Nested
              class ClassB {
                @Test fun testMethod() {}
              }

              class ClassC

              private class ClassD
              
              @Nested
              class ClassE {
                @Test fun testMethod() {}
              }
            }

            @Nested
            class ClassX // not nested — should be ignored

            private class ClassY

            class ClassZ {
              @Test fun testMethod() {}
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("ClassDetectionTest", ".kt")
    tempFile.writeText(kotlinSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output
    val expected =
        mapOf(
            "ClassAClassB" to "dev.test.ClassA\$ClassB",
            "ClassAClassE" to "dev.test.ClassA\$ClassE",
            "ClassZ" to "dev.test.ClassZ")

    assertEquals(expected, result)
  }

  @Test
  fun `excludes interfaces from Java class detection`() {
    val javaSource =
        """
            package org.springframework.boot.loader.jarmode;

            /**
             * Interface registered in spring.factories to provides extended 'jarmode'
             * support.
             *
             * @author Phillip Webb
             * @since 2.3.0
             */
            public interface JarMode {
                void run(String jarMode, String[] args);
            }

            public class TestClass {
                @Test
                public void testMethod() {
                    // test implementation
                }
                
                // This interface should be excluded
                public interface NestedInterface {
                    void nestedMethod();
                }
                
                // This nested class should be included if it has @Nested
                @Nested
                public class NestedTestClass {
                    @Test
                    public void nestedTest() {}
                }
            }

            // Another interface that should be excluded
            public interface AnotherInterface {
                @Test  // Even with test annotations, interfaces should be excluded
                default void defaultTest() {}
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("JavaInterfaceTest", ".java")
    tempFile.writeText(javaSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Key assertions: Verify interfaces are excluded
    result?.let { actualResult ->
      // Should NOT contain any interface names
      assertFalse(actualResult.containsKey("JarMode"), "Should not include JarMode interface")
      assertFalse(actualResult.containsKey("NestedInterface"), "Should not include NestedInterface")
      assertFalse(
          actualResult.containsKey("AnotherInterface"),
          "Should not include AnotherInterface interface")

      // Should contain TestClass (has @Test annotation)
      assertTrue(
          actualResult.containsKey("TestClass"), "Should include TestClass with @Test annotation")

      // Verify the values don't contain interface references
      actualResult.values.forEach { fullClassName ->
        assertFalse(
            fullClassName.contains("JarMode"), "Class names should not reference JarMode interface")
        assertFalse(
            fullClassName.contains("NestedInterface"),
            "Class names should not reference NestedInterface")
        assertFalse(
            fullClassName.contains("AnotherInterface"),
            "Class names should not reference AnotherInterface")
      }
    }
  }

  @Test
  fun `detects nested test classes like Spring Boot ExtractCommandTests`() {
    val javaSource =
        """
            package org.springframework.boot.jarmode.tools;

            import org.junit.jupiter.api.BeforeEach;
            import org.junit.jupiter.api.Nested;
            import org.junit.jupiter.api.Test;

            /**
             * Tests for ExtractCommand.
             */
            class ExtractCommandTests extends AbstractJarModeTests {

                @BeforeEach
                void setUp() throws IOException {
                    // setup code
                }

                @Nested
                class Extract {
                    @Test
                    void extractLibrariesAndCreatesApplication() throws IOException {
                        // test implementation
                    }
                    
                    @Test
                    void applicationContainsManifestEntries() throws IOException {
                        // test implementation  
                    }
                }

                @Nested
                class ExtractWithLayers {
                    @Test
                    void extractLibrariesAndCreatesApplication() throws IOException {
                        // test implementation
                    }
                    
                    @Test
                    void extractsOnlySelectedLayers() throws IOException {
                        // test implementation
                    }
                }

                @Nested
                class ExtractLauncher {
                    @Test
                    void extract() throws IOException {
                        // test implementation
                    }
                }

                @Nested
                class ExtractLauncherWithLayers {
                    @Test
                    void extract() throws IOException {
                        // test implementation
                    }
                }
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("SpringBootExtractTest", ".java")
    tempFile.writeText(javaSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output - should detect all @Nested classes and parent since it has @BeforeEach
    val expected =
        mapOf(
            "ExtractCommandTests" to "org.springframework.boot.jarmode.tools.ExtractCommandTests",
            "ExtractCommandTestsExtract" to
                "org.springframework.boot.jarmode.tools.ExtractCommandTests\$Extract",
            "ExtractCommandTestsExtractWithLayers" to
                "org.springframework.boot.jarmode.tools.ExtractCommandTests\$ExtractWithLayers",
            "ExtractCommandTestsExtractLauncher" to
                "org.springframework.boot.jarmode.tools.ExtractCommandTests\$ExtractLauncher",
            "ExtractCommandTestsExtractLauncherWithLayers" to
                "org.springframework.boot.jarmode.tools.ExtractCommandTests\$ExtractLauncherWithLayers")

    assertEquals(expected, result)
  }

  @Test
  fun `detects only nested classes when parent has no direct test methods but has nested tests`() {
    val javaSource =
        """
            package com.example;

            import org.junit.jupiter.api.extension.ExtendWith;
            import org.junit.jupiter.api.Nested;
            import org.junit.jupiter.api.Test;
            import org.junit.jupiter.api.BeforeEach;
            import org.junit.jupiter.api.AfterEach;

            @ExtendWith(OutputCaptureExtension.class)
            @AssertFileChannelDataBlocksClosed
            class LauncherTests {

                /**
                 * Jar Mode tests.
                 */
                @Nested
                class JarMode {

                    @BeforeEach
                    void setup() {
                        System.setProperty(JarModeRunner.DISABLE_SYSTEM_EXIT, "true");
                    }

                    @AfterEach
                    void cleanup() {
                        System.clearProperty("jarmode");
                        System.clearProperty(JarModeRunner.DISABLE_SYSTEM_EXIT);
                    }

                    @Test
                    void launchWhenJarModePropertyIsSetLaunchesJarMode() throws Exception {
                        // test implementation
                    }

                    @Test
                    void launchWhenJarModePropertyIsNotAcceptedThrowsException() throws Exception {
                        // test implementation
                    }

                    @Test
                    void launchWhenJarModeRunFailsWithErrorExceptionPrintsSimpleMessage() throws Exception {
                        // test implementation
                    }

                    @Test
                    void launchWhenJarModeRunFailsWithErrorExceptionPrintsStackTrace() throws Exception {
                        // test implementation
                    }
                }

                private static final class TestLauncher extends Launcher {
                    @Override
                    protected String getMainClass() throws Exception {
                        throw new IllegalStateException("Should not be called");
                    }
                }
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("LauncherTest", ".java")
    tempFile.writeText(javaSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output - should detect only the nested class, not the parent
    val expected = mapOf("LauncherTestsJarMode" to "com.example.LauncherTests\$JarMode")

    assertEquals(expected, result)
  }

  @Test
  fun `excludes classes with only setup annotations but no test methods`() {
    val javaSource =
        """
            package com.example;

            import org.springframework.test.context.TestPropertySource;
            import org.junit.jupiter.api.extension.ExtendWith;

            @TestPropertySource(properties = { "spring.jersey.type=filter", "server.servlet.register-default-servlet=true" })
            class JerseyFilterApplicationTests extends AbstractJerseyApplicationTests {
                // No test methods, no @Nested classes
                // Should NOT generate a target
            }
            
            @ExtendWith(SomeExtension.class)
            class AnotherSetupOnlyClass {
                // No test methods, no @Nested classes
                // Should NOT generate a target
            }
            
            @TestPropertySource(properties = { "some.prop=value" })
            class ClassWithTestMethod {
                @Test
                void actualTest() {
                    // This class should generate a target because it has a test method
                }
            }
        """
            .trimIndent()

    // Write to temp file
    val tempFile = File.createTempFile("SetupOnlyTest", ".java")
    tempFile.writeText(javaSource)
    tempFile.deleteOnExit()

    // Run the function
    val result = getAllVisibleClassesWithNestedAnnotation(tempFile)

    // Expected output - should only include the class with actual test methods
    val expected = mapOf("ClassWithTestMethod" to "com.example.ClassWithTestMethod")

    assertEquals(expected, result)
  }
}
