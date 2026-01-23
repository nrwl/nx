package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm

/**
 * Custom ClassRealm that exposes the protected defineClass method.
 *
 * This allows us to inject adapter classes into the realm without using
 * reflection, eliminating the need for --add-opens JVM flags.
 */
class NxClassRealm(
    world: ClassWorld,
    id: String,
    parent: ClassLoader?
) : ClassRealm(world, id, parent) {

    /**
     * Define a class in this realm from bytecode.
     *
     * This is a public wrapper around the protected ClassLoader.defineClass method,
     * allowing adapter classes to be injected into Maven's classloader.
     *
     * @param name The fully qualified class name (e.g., "dev.nx.maven.adapter.maven4.NxMaven")
     * @param bytes The class bytecode
     * @return The defined Class object
     */
    fun defineClass(name: String, bytes: ByteArray): Class<*> {
        return defineClass(name, bytes, 0, bytes.size)
    }
}
