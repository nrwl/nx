import { getRandomItem } from '@tuskdesign/util';

export type Animal = {
  name: string;
  sound: string;
};

export const ANIMALS = [
  {
    name: 'dog',
    sound: 'bark',
  },
  {
    name: 'cat',
    sound: 'meow',
  },
  {
    name: 'cow',
    sound: 'moo',
  },
  {
    name: 'rooster',
    sound: 'cock-a-doodle-doo',
  },
  {
    name: 'pig',
    sound: 'oink',
  },
];

export function getRandomAnimal() {
  return getRandomItem(ANIMALS);
}
