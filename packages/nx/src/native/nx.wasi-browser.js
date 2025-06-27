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
  __napiInstance.exports['__napi_register__expand_outputs_0']?.()
  __napiInstance.exports['__napi_register__get_files_for_outputs_1']?.()
  __napiInstance.exports['__napi_register__remove_2']?.()
  __napiInstance.exports['__napi_register__copy_3']?.()
  __napiInstance.exports['__napi_register__validate_outputs_4']?.()
  __napiInstance.exports['__napi_register__get_transformable_outputs_5']?.()
  __napiInstance.exports['__napi_register__hash_array_6']?.()
  __napiInstance.exports['__napi_register__hash_file_7']?.()
  __napiInstance.exports['__napi_register__can_install_nx_console_8']?.()
  __napiInstance.exports['__napi_register__install_nx_console_9']?.()
  __napiInstance.exports['__napi_register__NxConsolePreferences_struct_10']?.()
  __napiInstance.exports['__napi_register__NxConsolePreferences_impl_14']?.()
  __napiInstance.exports['__napi_register__log_debug_15']?.()
  __napiInstance.exports['__napi_register__log_error_16']?.()
  __napiInstance.exports['__napi_register__IS_WASM_17']?.()
  __napiInstance.exports['__napi_register__get_binary_target_18']?.()
  __napiInstance.exports['__napi_register__ImportResult_struct_19']?.()
  __napiInstance.exports['__napi_register__find_imports_20']?.()
  __napiInstance.exports['__napi_register__transfer_project_graph_21']?.()
  __napiInstance.exports['__napi_register__ExternalNode_struct_22']?.()
  __napiInstance.exports['__napi_register__Target_struct_23']?.()
  __napiInstance.exports['__napi_register__Project_struct_24']?.()
  __napiInstance.exports['__napi_register__ProjectGraph_struct_25']?.()
  __napiInstance.exports['__napi_register__HashPlanner_struct_26']?.()
  __napiInstance.exports['__napi_register__HashPlanner_impl_30']?.()
  __napiInstance.exports['__napi_register__HashDetails_struct_31']?.()
  __napiInstance.exports['__napi_register__HasherOptions_struct_32']?.()
  __napiInstance.exports['__napi_register__TaskHasher_struct_33']?.()
  __napiInstance.exports['__napi_register__TaskHasher_impl_36']?.()
  __napiInstance.exports['__napi_register__Task_struct_37']?.()
  __napiInstance.exports['__napi_register__TaskTarget_struct_38']?.()
  __napiInstance.exports['__napi_register__TaskResult_struct_39']?.()
  __napiInstance.exports['__napi_register__TaskGraph_struct_40']?.()
  __napiInstance.exports['__napi_register__FileData_struct_41']?.()
  __napiInstance.exports['__napi_register__InputsInput_struct_42']?.()
  __napiInstance.exports['__napi_register__FileSetInput_struct_43']?.()
  __napiInstance.exports['__napi_register__RuntimeInput_struct_44']?.()
  __napiInstance.exports['__napi_register__EnvironmentInput_struct_45']?.()
  __napiInstance.exports['__napi_register__ExternalDependenciesInput_struct_46']?.()
  __napiInstance.exports['__napi_register__DepsOutputsInput_struct_47']?.()
  __napiInstance.exports['__napi_register__NxJson_struct_48']?.()
  __napiInstance.exports['__napi_register__FileLock_struct_49']?.()
  __napiInstance.exports['__napi_register__FileLock_impl_51']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_struct_52']?.()
  __napiInstance.exports['__napi_register__WorkspaceContext_impl_63']?.()
  __napiInstance.exports['__napi_register__WorkspaceErrors_64']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFiles_struct_65']?.()
  __napiInstance.exports['__napi_register__NxWorkspaceFilesExternals_struct_66']?.()
  __napiInstance.exports['__napi_register__UpdatedWorkspaceFiles_struct_67']?.()
  __napiInstance.exports['__napi_register__FileMap_struct_68']?.()
  __napiInstance.exports['__napi_register____test_only_transfer_file_map_69']?.()
}
export const FileLock = __napiModule.exports.FileLock
export const HashPlanner = __napiModule.exports.HashPlanner
export const ImportResult = __napiModule.exports.ImportResult
export const NxConsolePreferences = __napiModule.exports.NxConsolePreferences
export const TaskHasher = __napiModule.exports.TaskHasher
export const WorkspaceContext = __napiModule.exports.WorkspaceContext
export const canInstallNxConsole = __napiModule.exports.canInstallNxConsole
export const copy = __napiModule.exports.copy
export const expandOutputs = __napiModule.exports.expandOutputs
export const findImports = __napiModule.exports.findImports
export const getBinaryTarget = __napiModule.exports.getBinaryTarget
export const getFilesForOutputs = __napiModule.exports.getFilesForOutputs
export const getTransformableOutputs = __napiModule.exports.getTransformableOutputs
export const hashArray = __napiModule.exports.hashArray
export const hashFile = __napiModule.exports.hashFile
export const installNxConsole = __napiModule.exports.installNxConsole
export const IS_WASM = __napiModule.exports.IS_WASM
export const logDebug = __napiModule.exports.logDebug
export const logError = __napiModule.exports.logError
export const remove = __napiModule.exports.remove
export const testOnlyTransferFileMap = __napiModule.exports.testOnlyTransferFileMap
export const transferProjectGraph = __napiModule.exports.transferProjectGraph
export const validateOutputs = __napiModule.exports.validateOutputs
export const WorkspaceErrors = __napiModule.exports.WorkspaceErrors
