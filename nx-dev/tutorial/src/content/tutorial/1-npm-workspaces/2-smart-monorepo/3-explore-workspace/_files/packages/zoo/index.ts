import { getRandomAnimal } from "@tuskdesign/animals";
import { getRandomName } from "@tuskdesign/names";

const name = getRandomName();
const animal = getRandomAnimal();

console.log(`${name} the ${animal.name} says ${animal.sound}!`);
