@echo off
setlocal
set VS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build
cd /d %~dp0

call "%VS%\vcvarsarm64.bat" >nul || exit /b 1
cl /nologo /O2 /MT /W3 /LD fstrace.c /link /OUT:fstrace.dll || exit /b 1
cl /nologo /O2 /MT /W3 tracer.c /link /OUT:fstrace.exe || exit /b 1
cl /nologo /O2 /MT openloop-win.c /Fe:openloop.exe || exit /b 1
endlocal

rem An x64 binary, to see what happens to emulated processes on ARM64 Windows.
setlocal
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsarm64_amd64.bat" >nul || exit /b 1
cl /nologo /O2 /MT openloop-win.c /Fe:openloop-x64.exe || exit /b 1
