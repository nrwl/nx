export function removeChildrenFromContainer(container: HTMLElement) {
  Array.from(container.children).forEach((child) =>
    container.removeChild(child)
  );
}
