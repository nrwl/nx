// import {
//   addDependenciesToPackageJson,
//   formatFiles,
//   GeneratorCallback,
//   globAsync,
//   logger,
//   readNxJson,
//   runTasksInSerial,
//   Tree,
//   updateNxJson,
// } from '@nx/devkit';
// import { nxVersion } from '../../utils/versions';
// import { InitGeneratorSchema } from './schema';
// import { hasMavenPlugin } from '../../utils/has-maven-plugin';
// import { dirname, join, basename } from 'path';
//
// export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
//   const tasks: GeneratorCallback[] = [];
//
//   if (!options.skipPackageJson && tree.exists('package.json')) {
//     tasks.push(
//       addDependenciesToPackageJson(
//         tree,
//         {},
//         {
//           '@nx/maven': nxVersion,
//         },
//         undefined,
//         options.keepExistingVersions
//       )
//     );
//   }
//
//   await addMavenWrapperIfNeeded(tree);
//   addPlugin(tree);
//   updateNxJsonConfiguration(tree);
//
//   if (!options.skipFormat) {
//     await formatFiles(tree);
//   }
//
//   return runTasksInSerial(...tasks);
// }
//
// function addPlugin(tree: Tree) {
//   const nxJson = readNxJson(tree);
//
//   if (!hasMavenPlugin(tree)) {
//     nxJson.plugins ??= [];
//     nxJson.plugins.push({
//       plugin: '@nx/maven',
//       options: {
//         testTargetName: 'test',
//         compileTargetName: 'compile',
//         packageTargetName: 'package',
//         installTargetName: 'install',
//         includeSubmodules: false,
//       },
//     });
//     updateNxJson(tree, nxJson);
//   }
// }
//
// /**
//  * This function adds the Maven wrapper to the project if it doesn't exist.
//  */
// export async function addMavenWrapperIfNeeded(tree: Tree) {
//   const pomFiles = await globAsync(tree, ['**/pom.xml']);
//
//   if (pomFiles.length === 0) {
//     logger.warn('No pom.xml files found in the workspace. Maven wrapper will not be added.');
//     return;
//   }
//
//   // Check if Maven wrapper already exists
//   const mvnwExists = tree.exists('mvnw') || tree.exists('mvnw.cmd');
//
//   if (!mvnwExists) {
//     logger.info('Adding Maven wrapper to the project...');
//
//     // Create a temporary directory to run the Maven wrapper command
//     const tempDir = join(tree.root, 'tmp-maven-wrapper');
//     tree.write(join(tempDir, 'pom.xml'), `
// <?xml version="1.0" encoding="UTF-8"?>
// <project xmlns="http://maven.apache.org/POM/4.0.0"
//          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
//          xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
//     <modelVersion>4.0.0</modelVersion>
//     <groupId>com.example</groupId>
//     <artifactId>maven-wrapper</artifactId>
//     <version>1.0-SNAPSHOT</version>
// </project>
//     `);
//
//     // Note: In a real implementation, we would run the Maven wrapper command here
//     // For now, we'll just create the files manually
//
//     // Create mvnw script
//     tree.write('mvnw', `#!/bin/sh
// # ----------------------------------------------------------------------------
// # Licensed to the Apache Software Foundation (ASF) under one
// # or more contributor license agreements.  See the NOTICE file
// # distributed with this work for additional information
// # regarding copyright ownership.  The ASF licenses this file
// # to you under the Apache License, Version 2.0 (the
// # "License"); you may not use this file except in compliance
// # with the License.  You may obtain a copy of the License at
// #
// #    http://www.apache.org/licenses/LICENSE-2.0
// #
// # Unless required by applicable law or agreed to in writing,
// # software distributed under the License is distributed on an
// # "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// # KIND, either express or implied.  See the License for the
// # specific language governing permissions and limitations
// # under the License.
// # ----------------------------------------------------------------------------
//
// # ----------------------------------------------------------------------------
// # Maven Start Up Batch script
// #
// # Required ENV vars:
// # ------------------
// #   JAVA_HOME - location of a JDK home dir
// #
// # Optional ENV vars
// # -----------------
// #   M2_HOME - location of maven2's installed home dir
// #   MAVEN_BATCH_ECHO - set to 'on' to enable the echoing of the batch commands
// #   MAVEN_BATCH_PAUSE - set to 'on' to wait for a keystroke before ending
// #   MAVEN_OPTS - parameters passed to the Java VM when running Maven
// #     e.g. to debug Maven itself, use
// #       set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
// #   MAVEN_SKIP_RC - flag to disable loading of mavenrc files
// # ----------------------------------------------------------------------------
//
// if [ -z "$MAVEN_SKIP_RC" ] ; then
//
//   if [ -f /etc/mavenrc ] ; then
//     . /etc/mavenrc
//   fi
//
//   if [ -f "$HOME/.mavenrc" ] ; then
//     . "$HOME/.mavenrc"
//   fi
//
// fi
//
// # OS specific support.  $var _must_ be set to either true or false.
// cygwin=false;
// darwin=false;
// mingw=false
// case "`uname`" in
//   CYGWIN*) cygwin=true ;;
//   MINGW*) mingw=true;;
//   Darwin*) darwin=true
//     # Use /usr/libexec/java_home if available, otherwise fall back to /Library/Java/Home
//     # See https://developer.apple.com/library/mac/qa/qa1170/_index.html
//     if [ -z "$JAVA_HOME" ]; then
//       if [ -x "/usr/libexec/java_home" ]; then
//         export JAVA_HOME="`/usr/libexec/java_home`"
//       else
//         export JAVA_HOME="/Library/Java/Home"
//       fi
//     fi
//     ;;
// esac
//
// if [ -z "$JAVA_HOME" ] ; then
//   if [ -r /etc/gentoo-release ] ; then
//     JAVA_HOME=`java-config --jre-home`
//   fi
// fi
//
// if [ -z "$JAVA_HOME" ]; then
//   javaExecutable="`which javac`"
//   if [ -n "$javaExecutable" ] && ! [ "`expr \\"$javaExecutable\\" : '\([^ ]*\)'`" = "no" ]; then
//     # readlink(1) is not available as standard on Solaris 10.
//     readLink=`which readlink`
//     if [ ! `expr \\"$readLink\\" : '\([^ ]*\)'` = "no" ]; then
//       if $darwin ; then
//         javaHome="`dirname \\"$javaExecutable\\"`"
//         javaExecutable="`cd \\"$javaHome\\" && pwd -P`/javac"
//       else
//         javaExecutable="`readlink -f \\"$javaExecutable\\"`"
//       fi
//       javaHome="`dirname \\"$javaExecutable\\"`"
//       javaHome=`expr "$javaHome" : '\\(.*\\)/bin'`
//       JAVA_HOME="$javaHome"
//       export JAVA_HOME
//     fi
//   fi
// fi
//
// if [ -z "$JAVACMD" ] ; then
//   if [ -n "$JAVA_HOME"  ] ; then
//     if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
//       # IBM's JDK on AIX uses strange locations for the executables
//       JAVACMD="$JAVA_HOME/jre/sh/java"
//     else
//       JAVACMD="$JAVA_HOME/bin/java"
//     fi
//   else
//     JAVACMD="`which java`"
//   fi
// fi
//
// if [ ! -x "$JAVACMD" ] ; then
//   echo "Error: JAVA_HOME is not defined correctly." >&2
//   echo "  We cannot execute $JAVACMD" >&2
//   exit 1
// fi
//
// if [ -z "$JAVA_HOME" ] ; then
//   echo "Warning: JAVA_HOME environment variable is not set."
// fi
//
// CLASSWORLDS_LAUNCHER=org.codehaus.plexus.classworlds.launcher.Launcher
//
// # traverses directory structure from process work directory to filesystem root
// # first directory with .mvn subdirectory is considered project base directory
// find_maven_basedir() {
//
//   if [ -z "$1" ]
//   then
//     echo "Path not specified to find_maven_basedir"
//     return 1
//   fi
//
//   basedir="$1"
//   wdir="$1"
//   while [ "$wdir" != '/' ] ; do
//     if [ -d "$wdir"/.mvn ] ; then
//       basedir=$wdir
//       break
//     fi
//     # workaround for JBEAP-8937 (on Solaris 10/Sparc)
//     if [ -d "${wdir}" ]; then
//       wdir=`cd "$wdir/.."; pwd`
//     fi
//     # end of workaround
//   done
//
//   echo "${basedir}"
// }
//
// # concatenates all lines of a file
// concat_lines() {
//   if [ -f "$1" ]; then
//     echo "$(tr -s '\\n' ' ' < "$1")"
//   fi
// }
//
// BASE_DIR=`find_maven_basedir "$(pwd)"`
// if [ -z "$BASE_DIR" ]; then
//   exit 1;
// fi
//
// ##########################################################################################
// # Extension to allow automatically downloading the maven-wrapper.jar from Maven-central
// # This allows using the maven wrapper in projects that prohibit checking in binary data.
// ##########################################################################################
// if [ -r "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
//     if [ "$MVNW_VERBOSE" = true ]; then
//       echo "Found .mvn/wrapper/maven-wrapper.jar"
//     fi
// else
//     if [ "$MVNW_VERBOSE" = true ]; then
//       echo "Couldn't find .mvn/wrapper/maven-wrapper.jar, downloading it ..."
//     fi
//     if [ -n "$MVNW_REPOURL" ]; then
//       jarUrl="$MVNW_REPOURL/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar"
//     else
//       jarUrl="https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar"
//     fi
//     while [ "$wget" != "true" ] && [ "$wget" != "false" ]; do
//       if command -v wget > /dev/null; then
//         wget=true
//       else
//         wget=false
//       fi
//     done
//     while [ "$curl" != "true" ] && [ "$curl" != "false" ]; do
//       if command -v curl > /dev/null; then
//         curl=true
//       else
//         curl=false
//       fi
//     done
//     if [ "$wget" = "true" ]; then
//       if [ "$MVNW_VERBOSE" = true ]; then
//         echo "Found wget ... using wget"
//       fi
//       if [ -z "$MVNW_USERNAME" ] || [ -z "$MVNW_PASSWORD" ]; then
//         wget "$jarUrl" -O "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar"
//       else
//         wget --http-user=$MVNW_USERNAME --http-password=$MVNW_PASSWORD "$jarUrl" -O "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar"
//       fi
//     elif [ "$curl" = "true" ]; then
//       if [ "$MVNW_VERBOSE" = true ]; then
//         echo "Found curl ... using curl"
//       fi
//       if [ -z "$MVNW_USERNAME" ] || [ -z "$MVNW_PASSWORD" ]; then
//         curl -o "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar" "$jarUrl" -f
//       else
//         curl --user $MVNW_USERNAME:$MVNW_PASSWORD -o "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar" "$jarUrl" -f
//       fi
//     else
//       if [ "$MVNW_VERBOSE" = true ]; then
//         echo "Falling back to using Java to download"
//       fi
//       javaClass="$BASE_DIR/.mvn/wrapper/MavenWrapperDownloader.java"
//       # For Cygwin, switch paths to Windows format before running javac
//       if $cygwin; then
//         javaClass=`cygpath --path --windows "$javaClass"`
//       fi
//       if command -v javac > /dev/null; then
//         echo "Compiling MavenWrapperDownloader.java ..."
//         ("$JAVA_HOME/bin/javac" "$javaClass")
//       else
//         echo "Error: javac is not available. Please ensure \$JAVA_HOME is set correctly."
//         exit 1
//       fi
//       if command -v java > /dev/null; then
//         echo "Running MavenWrapperDownloader.java ..."
//         ("$JAVA_HOME/bin/java" -cp .mvn/wrapper MavenWrapperDownloader "$MAVEN_PROJECTBASEDIR")
//       else
//         echo "Error: java is not available. Please ensure \$JAVA_HOME is set correctly."
//         exit 1
//       fi
//     fi
// fi
// ##########################################################################################
// # End of extension
// ##########################################################################################
//
// export MAVEN_PROJECTBASEDIR=${MAVEN_BASEDIR:-"$BASE_DIR"}
// if [ "$MVNW_VERBOSE" = true ]; then
//   echo $MAVEN_PROJECTBASEDIR
// fi
// MAVEN_OPTS="$(concat_lines "$MAVEN_PROJECTBASEDIR/.mvn/jvm.config") $MAVEN_OPTS"
//
// # For Cygwin, switch paths to Windows format before running java
// if $cygwin; then
//   [ -n "$M2_HOME" ] &&
//     M2_HOME=`cygpath --path --windows "$M2_HOME"`
//   [ -n "$JAVA_HOME" ] &&
//     JAVA_HOME=`cygpath --path --windows "$JAVA_HOME"`
//   [ -n "$CLASSPATH" ] &&
//     CLASSPATH=`cygpath --path --windows "$CLASSPATH"`
//   [ -n "$MAVEN_PROJECTBASEDIR" ] &&
//     MAVEN_PROJECTBASEDIR=`cygpath --path --windows "$MAVEN_PROJECTBASEDIR"`
// fi
//
// # Provide a "standardized" way to retrieve the CLI args that will
// # work with both Windows and non-Windows executions.
// MAVEN_CMD_LINE_ARGS="$MAVEN_CONFIG $@"
// export MAVEN_CMD_LINE_ARGS
//
// WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
//
// exec "$JAVACMD" \
//   $MAVEN_OPTS \
//   $MAVEN_DEBUG_OPTS \
//   -classpath "$MAVEN_PROJECTBASEDIR/.mvn/wrapper/maven-wrapper.jar" \
//   "-Dmaven.home=${M2_HOME}" "-Dmaven.multiModuleProjectDirectory=${MAVEN_PROJECTBASEDIR}" \
//   ${WRAPPER_LAUNCHER} $MAVEN_CONFIG "$@"
//     `);
//
//     // Create mvnw.cmd script
//     tree.write('mvnw.cmd', `@REM ----------------------------------------------------------------------------
// @REM Licensed to the Apache Software Foundation (ASF) under one
// @REM or more contributor license agreements.  See the NOTICE file
// @REM distributed with this work for additional information
// @REM regarding copyright ownership.  The ASF licenses this file
// @REM to you under the Apache License, Version 2.0 (the
// @REM "License"); you may not use this file except in compliance
// @REM with the License.  You may obtain a copy of the License at
// @REM
// @REM    http://www.apache.org/licenses/LICENSE-2.0
// @REM
// @REM Unless required by applicable law or agreed to in writing,
// @REM software distributed under the License is distributed on an
// @REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// @REM KIND, either express or implied.  See the License for the
// @REM specific language governing permissions and limitations
// @REM under the License.
// @REM ----------------------------------------------------------------------------
//
// @REM ----------------------------------------------------------------------------
// @REM Maven Start Up Batch script
// @REM
// @REM Required ENV vars:
// @REM JAVA_HOME - location of a JDK home dir
// @REM
// @REM Optional ENV vars
// @REM M2_HOME - location of maven2's installed home dir
// @REM MAVEN_BATCH_ECHO - set to 'on' to enable the echoing of the batch commands
// @REM MAVEN_BATCH_PAUSE - set to 'on' to wait for a keystroke before ending
// @REM MAVEN_OPTS - parameters passed to the Java VM when running Maven
// @REM     e.g. to debug Maven itself, use
// @REM set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
// @REM MAVEN_SKIP_RC - flag to disable loading of mavenrc files
// @REM ----------------------------------------------------------------------------
//
// @REM Begin all REM lines with '@' in case MAVEN_BATCH_ECHO is 'on'
// @echo off
// @REM set title of command window
// title %0
// @REM enable echoing by setting MAVEN_BATCH_ECHO to 'on'
// @if "%MAVEN_BATCH_ECHO%" == "on"  echo %MAVEN_BATCH_ECHO%
//
// @REM set %HOME% to equivalent of $HOME
// if "%HOME%" == "" (set "HOME=%HOMEDRIVE%%HOMEPATH%")
//
// @REM Execute a user defined script before this one
// if not "%MAVEN_SKIP_RC%" == "" goto skipRcPre
// @REM check for pre script, once with legacy .bat ending and once with .cmd ending
// if exist "%USERPROFILE%\\mavenrc_pre.bat" call "%USERPROFILE%\\mavenrc_pre.bat" %*
// if exist "%USERPROFILE%\\mavenrc_pre.cmd" call "%USERPROFILE%\\mavenrc_pre.cmd" %*
// :skipRcPre
//
// @setlocal
//
// set ERROR_CODE=0
//
// @REM To isolate internal variables from possible post scripts, we use another setlocal
// @setlocal
//
// @REM ==== START VALIDATION ====
// if not "%JAVA_HOME%" == "" goto OkJHome
//
// echo.
// echo Error: JAVA_HOME not found in your environment. >&2
// echo Please set the JAVA_HOME variable in your environment to match the >&2
// echo location of your Java installation. >&2
// echo.
// goto error
//
// :OkJHome
// if exist "%JAVA_HOME%\\bin\\java.exe" goto init
//
// echo.
// echo Error: JAVA_HOME is set to an invalid directory. >&2
// echo JAVA_HOME = "%JAVA_HOME%" >&2
// echo Please set the JAVA_HOME variable in your environment to match the >&2
// echo location of your Java installation. >&2
// echo.
// goto error
//
// :init
// @REM Decide how to startup depending on the version of windows
//
// @REM -- Windows NT with Novell Login
// if "%OS%"=="WINNT" goto WinNTNovell
//
// @REM -- Win98ME
// if NOT "%OS%"=="Windows_NT" goto Win9xArg
//
// :WinNTNovell
//
// @REM -- 4NT shell
// if "%@eval[2+2]" == "4" goto 4NTArgs
//
// @REM -- Regular WinNT shell
// set MAVEN_CMD_LINE_ARGS=%*
// goto endInit
//
// :Win9xArg
// @REM Slurp the command line arguments.  This loop allows for an unlimited number
// @REM of arguments (up to the command line limit, anyway).
// set MAVEN_CMD_LINE_ARGS=
// :Win9xApp
// if %1a==a goto endInit
// set MAVEN_CMD_LINE_ARGS=%MAVEN_CMD_LINE_ARGS% %1
// shift
// goto Win9xApp
//
// :4NTArgs
// @REM Get arguments from the 4NT Shell from JP Software
// set MAVEN_CMD_LINE_ARGS=%$
//
// :endInit
//
// @REM Find the project base dir, i.e. the directory that contains the folder ".mvn".
// @REM Fallback to current working directory if not found.
//
// set MAVEN_PROJECTBASEDIR=%MAVEN_BASEDIR%
// IF NOT "%MAVEN_PROJECTBASEDIR%"=="" goto endDetectBaseDir
//
// set EXEC_DIR=%CD%
// set WDIR=%EXEC_DIR%
// :findBaseDir
// IF EXIST "%WDIR%"\.mvn goto baseDirFound
// cd ..
// IF "%WDIR%"=="%CD%" goto baseDirNotFound
// set WDIR=%CD%
// goto findBaseDir
//
// :baseDirFound
// set MAVEN_PROJECTBASEDIR=%WDIR%
// cd "%EXEC_DIR%"
// goto endDetectBaseDir
//
// :baseDirNotFound
// set MAVEN_PROJECTBASEDIR=%EXEC_DIR%
// cd "%EXEC_DIR%"
//
// :endDetectBaseDir
//
// IF NOT EXIST "%MAVEN_PROJECTBASEDIR%\.mvn\jvm.config" goto endReadAdditionalConfig
//
// @setlocal EnableExtensions EnableDelayedExpansion
// for /F "usebackq delims=" %%a in ("%MAVEN_PROJECTBASEDIR%\.mvn\jvm.config") do set JVM_CONFIG_MAVEN_PROPS=!JVM_CONFIG_MAVEN_PROPS! %%a
// @endlocal & set JVM_CONFIG_MAVEN_PROPS=%JVM_CONFIG_MAVEN_PROPS%
//
// :endReadAdditionalConfig
//
// SET MAVEN_JAVA_EXE="%JAVA_HOME%\bin\java.exe"
// set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
// set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
//
// set DOWNLOAD_URL="https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar"
//
// FOR /F "tokens=1,2 delims==" %%A IN ("%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties") DO (
//     IF "%%A"=="wrapperUrl" SET DOWNLOAD_URL=%%B
// )
//
// @REM Extension to allow automatically downloading the maven-wrapper.jar from Maven-central
// @REM This allows using the maven wrapper in projects that prohibit checking in binary data.
// if exist %WRAPPER_JAR% (
//     if "%MVNW_VERBOSE%" == "true" (
//         echo Found %WRAPPER_JAR%
//     )
// ) else (
//     if not "%MVNW_REPOURL%" == "" (
//         SET DOWNLOAD_URL="%MVNW_REPOURL%/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar"
//     )
//     if "%MVNW_VERBOSE%" == "true" (
//         echo Couldn't find %WRAPPER_JAR%, downloading it ...
//         echo Downloading from: %DOWNLOAD_URL%
//     )
//
//     powershell -Command "&{"^
// 		"$webclient = new-object System.Net.WebClient;"^
// 		"if (-not ([string]::IsNullOrEmpty('%MVNW_USERNAME%') -and [string]::IsNullOrEmpty('%MVNW_PASSWORD%'))) {"^
// 		"$webclient.Credentials = new-object System.Net.NetworkCredential('%MVNW_USERNAME%', '%MVNW_PASSWORD%');"^
// 		"}"^
// 		"[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $webclient.DownloadFile('%DOWNLOAD_URL%', '%WRAPPER_JAR%')"^
// 		"}"
//     if "%MVNW_VERBOSE%" == "true" (
//         echo Finished downloading %WRAPPER_JAR%
//     )
// )
// @REM End of extension
//
// @REM If specified, validate the SHA-256 sum of the Maven wrapper jar file
// SET WRAPPER_SHA_256_SUM=""
// FOR /F "tokens=1,2 delims==" %%A IN ("%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties") DO (
//     IF "%%A"=="wrapperSha256Sum" SET WRAPPER_SHA_256_SUM=%%B
// )
// IF NOT %WRAPPER_SHA_256_SUM%=="" (
//     powershell -Command "&{"^
//        "$hash = (Get-FileHash \"%WRAPPER_JAR%\" -Algorithm SHA256).Hash.ToLower();"^
//        "If('%WRAPPER_SHA_256_SUM%' -ne $hash){"^
//        "  Write-Output 'Error: Failed to validate Maven wrapper SHA-256, your Maven wrapper might be compromised.';"^
//        "  Write-Output 'Investigate or delete %WRAPPER_JAR% to attempt a clean download.';"^
//        "  Write-Output 'If you updated your Maven version, you need to update the specified wrapperSha256Sum property.';"^
//        "  exit 1;"^
//        "}"^
//        "}"
//     if ERRORLEVEL 1 goto error
// )
//
// @REM Provide a "standardized" way to retrieve the CLI args that will
// @REM work with both Windows and non-Windows executions.
// set MAVEN_CMD_LINE_ARGS=%*
//
// %MAVEN_JAVA_EXE% %JVM_CONFIG_MAVEN_PROPS% %MAVEN_OPTS% %MAVEN_DEBUG_OPTS% -classpath %WRAPPER_JAR% "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
// if ERRORLEVEL 1 goto error
// goto end
//
// :error
// set ERROR_CODE=1
//
// :end
// @endlocal & set ERROR_CODE=%ERROR_CODE%
//
// if not "%MAVEN_SKIP_RC%"=="" goto skipRcPost
// @REM check for post script, once with legacy .bat ending and once with .cmd ending
// if exist "%USERPROFILE%\\mavenrc_post.bat" call "%USERPROFILE%\\mavenrc_post.bat"
// if exist "%USERPROFILE%\\mavenrc_post.cmd" call "%USERPROFILE%\\mavenrc_post.cmd"
// :skipRcPost
//
// @REM pause the script if MAVEN_BATCH_PAUSE is set to 'on'
// if "%MAVEN_BATCH_PAUSE%"=="on" pause
//
// if "%MAVEN_TERMINATE_CMD%"=="on" exit %ERROR_CODE%
//
// cmd /C exit /B %ERROR_CODE%
//     `);
//
//     // Create .mvn directory structure
//     tree.write('.mvn/wrapper/maven-wrapper.properties', `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.5/apache-maven-3.9.5-bin.zip
// wrapperUrl=https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar
//     `);
//
//     // Create a simple pom.xml if none exists
//     if (pomFiles.length === 0) {
//       tree.write('pom.xml', `<?xml version="1.0" encoding="UTF-8"?>
// <project xmlns="http://maven.apache.org/POM/4.0.0"
//          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
//          xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
//     <modelVersion>4.0.0</modelVersion>
//
//     <groupId>com.example</groupId>
//     <artifactId>my-maven-project</artifactId>
//     <version>1.0-SNAPSHOT</version>
//
//     <properties>
//         <maven.compiler.source>11</maven.compiler.source>
//         <maven.compiler.target>11</maven.compiler.target>
//         <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
//     </properties>
//
//     <dependencies>
//         <dependency>
//             <groupId>junit</groupId>
//             <artifactId>junit</artifactId>
//             <version>4.13.2</version>
//             <scope>test</scope>
//         </dependency>
//     </dependencies>
// </project>
//       `);
//     }
//
//     logger.info('Maven wrapper added successfully.');
//   }
// }
//
// export function updateNxJsonConfiguration(tree: Tree) {
//   const nxJson = readNxJson(tree);
//
//   if (!nxJson.namedInputs) {
//     nxJson.namedInputs = {};
//   }
//   const defaultFilesSet = nxJson.namedInputs.default ?? [];
//   nxJson.namedInputs.default = Array.from(
//     new Set([...defaultFilesSet, '{projectRoot}/**/*'])
//   );
//   const productionFileSet = nxJson.namedInputs.production ?? [];
//   nxJson.namedInputs.production = Array.from(
//     new Set([...productionFileSet, 'default', '!{projectRoot}/src/test/**/*'])
//   );
//   updateNxJson(tree, nxJson);
// }
//
// export default initGenerator;
