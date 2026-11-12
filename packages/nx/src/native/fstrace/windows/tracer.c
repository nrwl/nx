// fstrace-<arch>.exe <none|trace> <log> <command line>
//   Runs the command in a job object and waits for the whole process tree to exit.
// fstrace-<arch>.exe inject <pid> <tid>
//   Loads fstrace-<arch>.dll into a suspended process of this architecture. The DLL runs
//   this when a traced process starts a child of another architecture.
#include "fstrace.h"
#include <stdio.h>
#include <stdlib.h>

static int inject(DWORD pid, DWORD tid) {
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_OPERATION | PROCESS_VM_WRITE, FALSE, pid);
  HANDLE thread = OpenThread(THREAD_SET_CONTEXT, FALSE, tid);
  WCHAR self[MAX_PATH];
  GetModuleFileNameW(NULL, self, MAX_PATH);
  BOOL ok = process && thread && fstrace_inject(process, thread, self, CreateProcessW);
  if (thread) CloseHandle(thread);
  if (process) CloseHandle(process);
  return ok ? 0 : 1;
}

int wmain(int argc, wchar_t **argv) {
  if (argc == 4 && wcscmp(argv[1], L"inject") == 0) return inject(wcstoul(argv[2], NULL, 10), wcstoul(argv[3], NULL, 10));
  if (argc != 4) {
    fwprintf(stderr, L"usage: fstrace.exe <none|trace> <log> <command line>\n");
    return 2;
  }
  BOOL trace = wcscmp(argv[1], L"trace") == 0;
  WCHAR self[MAX_PATH];
  GetModuleFileNameW(NULL, self, MAX_PATH);
  if (trace) {
    CloseHandle(CreateFileW(argv[2], GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, CREATE_ALWAYS, 0, NULL));
    SetEnvironmentVariableW(L"FSTRACE_OUT", argv[2]);
  }

  HANDLE job = CreateJobObjectW(NULL, NULL);
  HANDLE port = CreateIoCompletionPort(INVALID_HANDLE_VALUE, NULL, 0, 1);
  JOBOBJECT_ASSOCIATE_COMPLETION_PORT acp = {job, port};
  SetInformationJobObject(job, JobObjectAssociateCompletionPortInformation, &acp, sizeof acp);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {0};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof limits);

  // The command gets this process's standard handles, which nx passes as pipes. A
  // launcher started detached has no console, and the command must not open one.
  STARTUPINFOW si = {sizeof si};
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
  DWORD flags = CREATE_SUSPENDED | (GetConsoleWindow() ? 0 : CREATE_NO_WINDOW);
  PROCESS_INFORMATION pi;
  wchar_t *cmd = _wcsdup(argv[3]);
  if (!CreateProcessW(NULL, cmd, NULL, NULL, TRUE, flags, NULL, NULL, &si, &pi)) {
    fwprintf(stderr, L"spawn failed: %lu\n", GetLastError());
    return 127;
  }
  AssignProcessToJobObject(job, pi.hProcess);
  if (trace && !fstrace_inject(pi.hProcess, pi.hThread, self, CreateProcessW)) fwprintf(stderr, L"fstrace: inject failed\n");
  ResumeThread(pi.hThread);

  DWORD msg;
  ULONG_PTR key;
  LPOVERLAPPED ov;
  while (GetQueuedCompletionStatus(port, &msg, &key, &ov, INFINITE))
    if (msg == JOB_OBJECT_MSG_ACTIVE_PROCESS_ZERO && (HANDLE)key == job) break;
  DWORD code = 1;
  GetExitCodeProcess(pi.hProcess, &code);
  return (int)code;
}
