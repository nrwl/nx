import {
  instantiateNapiModuleSync as __emnapiInstantiateNapiModuleSync,
  getDefaultContext as __emnapiGetDefaultContext,
  WASI as __WASI,
} from '@napi-rs/wasm-runtime'
import { Volume as __Volume, createFsFromVolume as __createFsFromVolume } from '@napi-rs/wasm-runtime/fs'

import __wasmUrl from './nx.wasm32-wasi.wasm?url'

const __fs = __createFsFromVolume(
  __Volume.fromJSON({
    '/': null,
  }),
)

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
})

const __emnapiContext = __emnapiGetDefaultContext()

const __sharedMemory = new WebAssembly.Memory({
  initial: 1024,
  maximum: 10240,
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
    return new Worker(new URL('./wasi-worker-browser.mjs', import.meta.url), {
      type: 'module',
    })
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
  __napiInstance.exports['__napi_register__expand_outputs_0']?.()
  __napiInstance.exports['__napi_register__get_files_for_outputs_1']?.()
  __napiInstance.exports['__napi_register__remove_2']?.()
  __napiInstance.exports['__napi_register__copy_3']?.()
  __napiInstance.exports['__napi_register__hash_array_4']?.()
  __napiInstance.exports['__napi_register__hash_file_5']?.()
  __napiInstance.exports['__napi_register__ImportResult_struct_6']?.()
  __napiInstance.exports['__napi_register__find_imports_7']?.()
  __napiInstance.exports['__napi_register__transfer_project_graph_8']?.()
  __napiInstance.exports['__napi_register__ExternalNodeData_struct_9']?.()
  __napiInstance.exports['__napi_register__ExternalNode_struct_10']?.()
  __napiInstance.exports['__napi_register__Target_struct_11']?.()
  __napiInstance.exports['__napi_register__Project_struct_12']?.()
  __napiInstance.exports['__napi_register__ProjectGraph_struct_13']?.()
  __napiInstance.exports['__napi_register__HashPlanner_struct_14']?.()
  __napiInstance.exports['__napi_register__HashPlanner_impl_18']?.()
  __napiInstance.exports['__napi_register__HashDetails_struct_19']?.()
  __napiInstance.exports['__napi_register__HasherOptions_struct_20']?.()
  __napiInstance.exports['__napi_register__TaskHasher_struct_21']?.()
  __napiInstance.exports['__napi_register__TaskHasher_impl_24']?.()
  __napiInstance.exports['__napi_register__Task_struct_25']?.()
  __napiInstance.exports['__napi_register__TaskTarget_struct_26']?.()
  __napiInstance.exports['__napi_register__TaskGraph_struct_27']?.()
  __napiInstance.exports['__napi_register__FileData_struct_28']?.()
  __napiInstance.exports['__napi_register__InputsInput_struct_29']?.()
  __napiInstance.exports['__napi_register__FileSetInput_struct_30']?.()
  __napiInstance.exports['__napi_register__RuntimeInput_struct_31']?.()
  __napiInstance.exports['__napi_register__EnvironmentInput_struct_32']?.()
  __napiInstance.exports['__napi_register__ExternalDependenciesInput_struct_33']?.()
  __napiInstance.exports['__napi_register__DepsOutputsInput_struct_34']?.()
  __napiInstance.exports['__napi_register__NxJson_struct_35']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_struct_36']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_impl_45']?.()
  __napiInstance.exports['__napi_register__WorkspaceErrors_46']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFiles_struct_47']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFilesExternals_struct_48']?.()
  __napiInstance.exports['__napi_register__UpdatedWorkspaceFiles_struct_49']?.()
  __napiInstance.exports['__napi_register__FileMap_struct_50']?.()
  __napiInstance.exports['__napi_register____test_only_transfer_file_map_51']?.()
}
export const HashPlanner = __napiModule.exports.HashPlanner
export const ImportResult = __napiModule.exports.ImportResult
export const TaskHasher = __napiModule.exports.TaskHasher
export const WorkspaceContext = __napiModule.exports.WorkspaceContext
export const copy = __napiModule.exports.copy
export const expandOutputs = __napiModule.exports.expandOutputs
export const findImports = __napiModule.exports.findImports
export const getFilesForOutputs = __napiModule.exports.getFilesForOutputs
export const hashArray = __napiModule.exports.hashArray
export const hashFile = __napiModule.exports.hashFile
export const remove = __napiModule.exports.remove
export const testOnlyTransferFileMap = __napiModule.exports.testOnlyTransferFileMap
export const transferProjectGraph = __napiModule.exports.transferProjectGraph
export const WorkspaceErrors = __napiModule.exports.WorkspaceErrors
