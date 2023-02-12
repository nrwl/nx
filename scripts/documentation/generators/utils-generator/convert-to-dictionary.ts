// Create packages dictionary mapping
export function convertToDictionary<OBJECT>(
  arr: OBJECT[],
  ref: PropertyKey
): Record<PropertyKey, OBJECT> {
  return Object.fromEntries(
    arr.map((a) => {
      function assertRef(
        value: PropertyKey,
        target: OBJECT
      ): value is keyof OBJECT {
        return value in target;
      }

      if (!assertRef(ref, a))
        throw new Error(
          `Property '${ref.toString()}' can not be found in passed object.`
        );
      return [a[ref], a];
    })
  );
}
