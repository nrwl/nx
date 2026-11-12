@echo off
rem Builds openloop-<arch>.exe for arm64, x64 and x86, the test programs the demo and bench
rem use. The tracer itself is built by scripts/build-fstrace-shim.mjs.
setlocal
set VS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build
cd /d %~dp0
call :build arm64 vcvarsarm64.bat || exit /b 1
call :build x64 vcvarsarm64_amd64.bat || exit /b 1
call :build x86 vcvarsarm64_x86.bat || exit /b 1
exit /b 0

:build
setlocal
call "%VS%\%2" >nul || exit /b 1
if not exist obj-%1 mkdir obj-%1
cl /nologo /O2 /MT /Fo:obj-%1\ openloop-win.c /Fe:openloop-%1.exe || exit /b 1
endlocal
exit /b 0
