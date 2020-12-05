import { move, Rule } from '@angular-devkit/schematics';

export default function update(): Rule {
  return move('tools/schematics', 'tools/generators');
}
