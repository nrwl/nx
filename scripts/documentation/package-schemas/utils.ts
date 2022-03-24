export const isObject = (value): value is {} => {
  return !!(value && typeof value === 'object' && !Array.isArray(value));
};
export const isArray = (value): value is Array<any> => {
  return !!(value && typeof value === 'object' && Array.isArray(value));
};
