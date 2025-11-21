// normalize to allow only JavaScript var valid names
export function normalizeProjectName(name: string) {
  // Replace invalid starting characters with '_'
  const normalized = name.replace(/^[^a-zA-Z_$]/, '_');
  // Replace invalid subsequent characters with '_'
  return normalized.replace(/[^a-zA-Z0-9_$]/g, '_');
}
