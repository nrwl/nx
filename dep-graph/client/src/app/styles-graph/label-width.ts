import { NodeSingular } from 'cytoscape';

export class LabelWidthCalculator {
  private cache: Map<string, number> = new Map<string, number>();
  private ctx: CanvasRenderingContext2D;

  calculateWidth(node: NodeSingular) {
    if (!this.ctx) {
      this.ctx = document.createElement('canvas').getContext('2d');
      const fStyle = node.style('font-style');
      const size = node.style('font-size');
      const family = node.style('font-family');
      const weight = node.style('font-weight');

      this.ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;
    }
    const label = node.data('id');

    if (this.cache.has(label)) {
      return this.cache.get(label);
    } else {
      const width = this.ctx.measureText(node.data('id')).width;

      this.cache.set(label, width);
      return width;
    }
  }
}
