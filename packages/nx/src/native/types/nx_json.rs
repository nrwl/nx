use crate::native::types::JsInputs;
use std::collections::HashMap;

#[napi(object)]
/// Stripped version of the NxJson interface for use in rust
pub struct NxJson {
    #[napi(ts_type = "Record<string, Array<InputsInput | string | FileSetInput | RuntimeInput | EnvironmentInput | ExternalDependenciesInput | DepsOutputsInput | WorkingDirectoryInput>>")]
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
}
