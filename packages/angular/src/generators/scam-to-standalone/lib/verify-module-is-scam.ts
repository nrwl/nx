export function verifyModuleIsScam(
  exportsArray: string[],
  componentName: string,
  declarationsArray: string[]
) {
  // Check exports has 1 export and check export exists in declaration and is the same as the component name
  if (
    exportsArray.length !== 1 &&
    !(
      exportsArray.includes(componentName) &&
      declarationsArray.includes(componentName)
    )
  ) {
    throw new Error(
      `The NgModule is not a SCAM. Please ensure the NgModule only contains one export and that the component is both declared and exported from the NgModule.`
    );
  }
}
