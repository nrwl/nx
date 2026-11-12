// Loaded into every process in the traced tree. Rebinds import-table entries for ntdll's
// file opens and for CreateProcessW, records successful read-opens of regular files to
// %FSTRACE_OUT%, and injects itself into child processes.
#include "fstrace.h"
#include <winternl.h>
#include <psapi.h>

#ifndef FILE_DIRECTORY_FILE
#define FILE_DIRECTORY_FILE 0x00000001
#endif
#define READS (FILE_READ_DATA | FILE_EXECUTE | GENERIC_READ | GENERIC_EXECUTE | GENERIC_ALL | MAXIMUM_ALLOWED)

typedef NTSTATUS(NTAPI *PFN_NtCreateFile)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES, PIO_STATUS_BLOCK,
                                          PLARGE_INTEGER, ULONG, ULONG, ULONG, ULONG, PVOID, ULONG);
typedef NTSTATUS(NTAPI *PFN_NtOpenFile)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES, PIO_STATUS_BLOCK, ULONG, ULONG);
typedef NTSTATUS(NTAPI *PFN_LdrLoadDll)(PWSTR, PULONG, PUNICODE_STRING, PVOID *);

static PFN_NtCreateFile Real_NtCreateFile;
static PFN_NtOpenFile Real_NtOpenFile;
static PFN_LdrLoadDll Real_LdrLoadDll;
static PFN_CreateProcessW Real_CreateProcessW;
static HANDLE g_log = INVALID_HANDLE_VALUE;
static HMODULE g_self;
static WCHAR g_dll[MAX_PATH];
static __declspec(thread) int t_busy;

static void record(HANDLE h, POBJECT_ATTRIBUTES oa) {
  FILE_STANDARD_INFO info;
  if (GetFileInformationByHandleEx(h, FileStandardInfo, &info, sizeof info) && info.Directory) return;

  WCHAR wbuf[1024];
  const WCHAR *p;
  DWORD n;
  UNICODE_STRING *name = oa ? oa->ObjectName : NULL;
  // Absolute DOS paths are used as given; anything relative to a handle asks the kernel.
  if (name && !oa->RootDirectory && name->Length >= 14 && wcsncmp(name->Buffer, L"\\??\\", 4) == 0 &&
      name->Buffer[5] == L':') {
    p = name->Buffer + 4;
    n = name->Length / sizeof(WCHAR) - 4;
  } else {
    n = GetFinalPathNameByHandleW(h, wbuf, 1024, FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
    if (n == 0 || n >= 1024) return;
    p = wbuf;
    if (n > 4 && wcsncmp(p, L"\\\\?\\", 4) == 0) {
      p += 4;
      n -= 4;
    }
  }
  char out[4100];
  int len = WideCharToMultiByte(CP_UTF8, 0, p, n, out, sizeof out - 1, NULL, NULL);
  if (len <= 0) return;
  out[len++] = '\n';
  DWORD written;
  WriteFile(g_log, out, len, &written, NULL);
}

// Marks a child whose subtree is not traced, so a consumer can distrust the read list.
static void record_untraced(LPCWSTR app, LPWSTR cmd) {
  if (g_log == INVALID_HANDLE_VALUE) return;
  const WCHAR *what = app ? app : cmd ? cmd : L"?";
  char out[4100];
  int len = WideCharToMultiByte(CP_UTF8, 0, what, -1, out + 10, sizeof out - 12, NULL, NULL);
  if (len <= 1) return;
  memcpy(out, "!untraced ", 10);
  len += 9;
  out[len++] = '\n';
  DWORD written;
  WriteFile(g_log, out, len, &written, NULL);
}

static void maybe_record(NTSTATUS s, HANDLE *h, ACCESS_MASK access, POBJECT_ATTRIBUTES oa, ULONG opts) {
  if (!NT_SUCCESS(s) || !(access & READS) || (opts & FILE_DIRECTORY_FILE) || g_log == INVALID_HANDLE_VALUE || t_busy)
    return;
  t_busy = 1;
  DWORD err = GetLastError();
  record(*h, oa);
  SetLastError(err);
  t_busy = 0;
}

static NTSTATUS NTAPI My_NtCreateFile(PHANDLE h, ACCESS_MASK access, POBJECT_ATTRIBUTES oa, PIO_STATUS_BLOCK io,
                                      PLARGE_INTEGER size, ULONG attrs, ULONG share, ULONG disp, ULONG opts,
                                      PVOID ea, ULONG ealen) {
  NTSTATUS s = Real_NtCreateFile(h, access, oa, io, size, attrs, share, disp, opts, ea, ealen);
  maybe_record(s, h, access, oa, opts);
  return s;
}

static NTSTATUS NTAPI My_NtOpenFile(PHANDLE h, ACCESS_MASK access, POBJECT_ATTRIBUTES oa, PIO_STATUS_BLOCK io,
                                    ULONG share, ULONG opts) {
  NTSTATUS s = Real_NtOpenFile(h, access, oa, io, share, opts);
  maybe_record(s, h, access, oa, opts);
  return s;
}

static BOOL WINAPI My_CreateProcessW(LPCWSTR app, LPWSTR cmd, LPSECURITY_ATTRIBUTES pa, LPSECURITY_ATTRIBUTES ta,
                                     BOOL inherit, DWORD flags, LPVOID env, LPCWSTR cwd, LPSTARTUPINFOW si,
                                     LPPROCESS_INFORMATION pi) {
  if (!Real_CreateProcessW(app, cmd, pa, ta, inherit, flags | CREATE_SUSPENDED, env, cwd, si, pi)) return FALSE;
  if (!fstrace_inject(pi->hProcess, pi->hThread, g_dll, Real_CreateProcessW)) record_untraced(app, cmd);
  if (!(flags & CREATE_SUSPENDED)) ResumeThread(pi->hThread);
  return TRUE;
}

static void patch_module(HMODULE mod);

static NTSTATUS NTAPI My_LdrLoadDll(PWSTR path, PULONG flags, PUNICODE_STRING name, PVOID *base) {
  NTSTATUS s = Real_LdrLoadDll(path, flags, name, base);
  if (NT_SUCCESS(s) && base && *base) patch_module((HMODULE)*base);
  return s;
}

static struct {
  void **real;
  void *mine;
  void *kernel32_stub;
} g_hooks[] = {
    {(void **)&Real_NtCreateFile, (void *)My_NtCreateFile, NULL},
    {(void **)&Real_NtOpenFile, (void *)My_NtOpenFile, NULL},
    {(void **)&Real_LdrLoadDll, (void *)My_LdrLoadDll, NULL},
    {(void **)&Real_CreateProcessW, (void *)My_CreateProcessW, NULL},
};
#define NHOOKS (sizeof g_hooks / sizeof g_hooks[0])

static void patch_module(HMODULE mod) {
  if (mod == g_self) return;
  BYTE *b = (BYTE *)mod;
  IMAGE_NT_HEADERS *nt = (IMAGE_NT_HEADERS *)(b + ((IMAGE_DOS_HEADER *)b)->e_lfanew);
  IMAGE_DATA_DIRECTORY dir = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];
  if (!dir.VirtualAddress) return;
  for (IMAGE_IMPORT_DESCRIPTOR *d = (IMAGE_IMPORT_DESCRIPTOR *)(b + dir.VirtualAddress); d->Name; d++) {
    for (IMAGE_THUNK_DATA *t = (IMAGE_THUNK_DATA *)(b + d->FirstThunk); t->u1.Function; t++) {
      void **slot = (void **)&t->u1.Function;
      for (size_t i = 0; i < NHOOKS; i++) {
        if (*slot != *g_hooks[i].real && (!g_hooks[i].kernel32_stub || *slot != g_hooks[i].kernel32_stub)) continue;
        DWORD old;
        VirtualProtect(slot, sizeof *slot, PAGE_READWRITE, &old);
        *slot = g_hooks[i].mine;
        VirtualProtect(slot, sizeof *slot, old, &old);
      }
    }
  }
}

BOOL WINAPI DllMain(HINSTANCE hinst, DWORD reason, LPVOID reserved) {
  (void)reserved;
  if (reason != DLL_PROCESS_ATTACH) return TRUE;
  g_self = hinst;
  GetModuleFileNameW(hinst, g_dll, MAX_PATH);

  WCHAR out[MAX_PATH];
  if (GetEnvironmentVariableW(L"FSTRACE_OUT", out, MAX_PATH))
    g_log = CreateFileW(out, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL,
                        OPEN_EXISTING, 0, NULL);

  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  HMODULE kb = GetModuleHandleW(L"kernelbase.dll");
  Real_NtCreateFile = (PFN_NtCreateFile)GetProcAddress(ntdll, "NtCreateFile");
  Real_NtOpenFile = (PFN_NtOpenFile)GetProcAddress(ntdll, "NtOpenFile");
  Real_LdrLoadDll = (PFN_LdrLoadDll)GetProcAddress(ntdll, "LdrLoadDll");
  Real_CreateProcessW = (PFN_CreateProcessW)GetProcAddress(kb, "CreateProcessW");
  g_hooks[3].kernel32_stub = (void *)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "CreateProcessW");

  HMODULE mods[1024];
  DWORD needed;
  if (K32EnumProcessModules(GetCurrentProcess(), mods, sizeof mods, &needed))
    for (DWORD i = 0; i < needed / sizeof(HMODULE) && i < 1024; i++) patch_module(mods[i]);
  return TRUE;
}
