import {
  instantiateNapiModuleSync as __emnapiInstantiateNapiModuleSync,
  getDefaultContext as __emnapiGetDefaultContext,
  WASI as __WASI,
  createOnMessage as __wasmCreateOnMessageForFsProxy,
} from '@napi-rs/wasm-runtime'

import __wasmUrl from './nx.wasm32-wasi.wasm?url'

const __wasi = new __WASI({
  version: 'preview1',
})

const __emnapiContext = __emnapiGetDefaultContext()

const __sharedMemory = new WebAssembly.Memory({
  initial: 1024,
  maximum: 32768,
  shared: true,
})

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer())

const {
  instance: __napiInstance,
  module: __wasiModule,
  napiModule: __napiModule,
} = __emnapiInstantiateNapiModuleSync(__wasmFile, {
  context: __emnapiContext,
  asyncWorkPoolSize: 4,
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(new URL('./wasi-worker-browser.mjs', import.meta.url), {
      type: 'module',
    })
    
    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    __napi_rs_initialize_modules(instance)
  },
})

function __napi_rs_initialize_modules(__napiInstance) {
  __napiInstance.exports['__napi_register__CachedResult_struct_0']?.()
  __napiInstance.exports['__napi_register__NxCache_struct_1']?.()
  __napiInstance.exports['__napi_register__NxCache_impl_9']?.()
  __napiInstance.exports['__napi_register__expand_outputs_10']?.()
  __napiInstance.exports['__napi_register__get_files_for_outputs_11']?.()
  __napiInstance.exports['__napi_register__remove_12']?.()
  __napiInstance.exports['__napi_register__copy_13']?.()
  __napiInstance.exports['__napi_register__validate_outputs_14']?.()
  __napiInstance.exports['__napi_register__get_transformable_outputs_15']?.()
  __napiInstance.exports['__napi_register__hash_array_16']?.()
  __napiInstance.exports['__napi_register__hash_file_17']?.()
  __napiInstance.exports['__napi_register__IS_WASM_18']?.()
  __napiInstance.exports['__napi_register__get_binary_target_19']?.()
  __napiInstance.exports['__napi_register__ImportResult_struct_20']?.()
  __napiInstance.exports['__napi_register__find_imports_21']?.()
  __napiInstance.exports['__napi_register__transfer_project_graph_22']?.()
  __napiInstance.exports['__napi_register__ExternalNode_struct_23']?.()
  __napiInstance.exports['__napi_register__Target_struct_24']?.()
  __napiInstance.exports['__napi_register__Project_struct_25']?.()
  __napiInstance.exports['__napi_register__ProjectGraph_struct_26']?.()
  __napiInstance.exports['__napi_register__HashedTask_struct_27']?.()
  __napiInstance.exports['__napi_register__TaskDetails_struct_28']?.()
  __napiInstance.exports['__napi_register__TaskDetails_impl_31']?.()
  __napiInstance.exports['__napi_register__HashPlanner_struct_32']?.()
  __napiInstance.exports['__napi_register__HashPlanner_impl_36']?.()
  __napiInstance.exports['__napi_register__HashDetails_struct_37']?.()
  __napiInstance.exports['__napi_register__HasherOptions_struct_38']?.()
  __napiInstance.exports['__napi_register__TaskHasher_struct_39']?.()
  __napiInstance.exports['__napi_register__TaskHasher_impl_42']?.()
  __napiInstance.exports['__napi_register__TaskRun_struct_43']?.()
  __napiInstance.exports['__napi_register__NxTaskHistory_struct_44']?.()
  __napiInstance.exports['__napi_register__NxTaskHistory_impl_48']?.()
  __napiInstance.exports['__napi_register__Task_struct_49']?.()
  __napiInstance.exports['__napi_register__TaskTarget_struct_50']?.()
  __napiInstance.exports['__napi_register__TaskGraph_struct_51']?.()
  __napiInstance.exports['__napi_register__FileData_struct_52']?.()
  __napiInstance.exports['__napi_register__InputsInput_struct_53']?.()
  __napiInstance.exports['__napi_register__FileSetInput_struct_54']?.()
  __napiInstance.exports['__napi_register__RuntimeInput_struct_55']?.()
  __napiInstance.exports['__napi_register__EnvironmentInput_struct_56']?.()
  __napiInstance.exports['__napi_register__ExternalDependenciesInput_struct_57']?.()
  __napiInstance.exports['__napi_register__DepsOutputsInput_struct_58']?.()
  __napiInstance.exports['__napi_register__NxJson_struct_59']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_struct_60']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_impl_69']?.()
  __napiInstance.exports['__napi_register__WorkspaceErrors_70']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFiles_struct_71']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFilesExternals_struct_72']?.()
  __napiInstance.exports['__napi_register__UpdatedWorkspaceFiles_struct_73']?.()
  __napiInstance.exports['__napi_register__FileMap_struct_74']?.()
  __napiInstance.exports['__napi_register____test_only_transfer_file_map_75']?.()
}
export const HashPlanner = __napiModule.exports.HashPlanner
export const ImportResult = __napiModule.exports.ImportResult
export const NxCache = __napiModule.exports.NxCache
export const NxTaskHistory = __napiModule.exports.NxTaskHistory
export const TaskDetails = __napiModule.exports.TaskDetails
export const TaskHasher = __napiModule.exports.TaskHasher
export const WorkspaceContext = __napiModule.exports.WorkspaceContext
export const copy = __napiModule.exports.copy
export const expandOutputs = __napiModule.exports.expandOutputs
export const findImports = __napiModule.exports.findImports
export const getBinaryTarget = __napiModule.exports.getBinaryTarget
export const getFilesForOutputs = __napiModule.exports.getFilesForOutputs
export const getTransformableOutputs = __napiModule.exports.getTransformableOutputs
export const hashArray = __napiModule.exports.hashArray
export const hashFile = __napiModule.exports.hashFile
export const IS_WASM = __napiModule.exports.IS_WASM
export const remove = __napiModule.exports.remove
export const testOnlyTransferFileMap = __napiModule.exports.testOnlyTransferFileMap
export const transferProjectGraph = __napiModule.exports.transferProjectGraph
export const validateOutputs = __napiModule.exports.validateOutputs
export const WorkspaceErrors = __napiModule.exports.WorkspaceErrors
