import { EngineAdapter } from './engine-adapter';
import { DockerEngine } from './docker/docker-engine';
import { PodmanEngine } from './podman/podman-engine';

export function createEngine(name: 'docker' | 'podman'): EngineAdapter {
  switch (name) {
    case 'docker':
      return new DockerEngine();
    case 'podman':
      return new PodmanEngine();
    default:
      throw new Error(`Unsupported container engine: ${name}`);
  }
}
