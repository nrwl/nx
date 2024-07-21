import { NodeSingular } from 'cytoscape';

export class LabelWidthCalculator {
  private cache = new Map<string, number>();
  private ctx: CanvasRenderingContext2D;

  constructor() {}

  calculateWidth(node: NodeSingular): number {
    if (!this.ctx) {
      this.ctx = document
        .createElement('canvas')
        .getContext('2d') as CanvasRenderingContext2D;
    }
    const label = node.data('id');
    const fStyle = node.style('font-style');
    const size = node.style('font-size');
    const family = node.style('font-family');
    const weight = node.style('font-weight');

    this.ctx.font = fStyle + ' ' + weight + ' ' + size + ' ' + family;

    const cachedValue = this.cache.get(label);

    if (cachedValue) {
      return cachedValue;
    } else {
      const width = this.ctx.measureText(node.data('id')).width;

      this.cache.set(label, width);
      return width;
    }
  }

  calculateCompositeWidth(node: NodeSingular): number {
    if (!this.ctx) {
      this.ctx = document
        .createElement('canvas')
        .getContext('2d') as CanvasRenderingContext2D;
    }
    const label = node.data('label');
    const size = node.data('size') * 8;
    const fStyle = node.style('font-style');
    const fSize = node.style('font-size');
    const family = node.style('font-family');
    const weight = node.style('font-weight');

    this.ctx.font = fStyle + ' ' + weight + ' ' + fSize + ' ' + family;

    const cachedValue = this.cache.get(label);
    if (cachedValue) {
      return cachedValue;
    }

    let width = this.ctx.measureText(label).width;

    if (width >= size) {
      // padded by 24 to create more space for the label
      width += 24;
    } else {
      width = size * 1.5;
    }

    this.cache.set(label, width);
    return width;
  }
}
