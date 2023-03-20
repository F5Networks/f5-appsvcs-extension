@ECHO OFF

pushd %~dp0

REM Command file for Sphinx documentation

if "%SPHINXBUILD%" == "" (
	set SPHINXBUILD=sphinx-build
)
set SOURCEDIR=docs
set BUILDDIR=docs/_build
set SPHINXPROJ=F5ApplicationServices

if "%1" == "" goto help

node scripts/build/schema-build-doc.js
node scripts/build/schema-to-rst.js
node scripts/build/generate-all-properties-declaration.js -- --skip-require

%SPHINXBUILD% >NUL 2>NUL
if errorlevel 9009 (
	echo.
	echo.The 'sphinx-build' command was not found. Make sure you have Sphinx
	echo.installed, then set the SPHINXBUILD environment variable to point
	echo.to the full path of the 'sphinx-build' executable. Alternatively you
	echo.may add the Sphinx directory to PATH.
	echo.
	echo.If you don't have Sphinx installed, grab it from
	echo.http://sphinx-doc.org/
	exit /b 1
)

%SPHINXBUILD% -M %1 %SOURCEDIR% %BUILDDIR% %SPHINXOPTS%
goto end

:help
%SPHINXBUILD% -M help %SOURCEDIR% %BUILDDIR% %SPHINXOPTS%
goto end

if "%1" == "preview" (
	echo.Running sphinx-autobuild. View live edits at:
	echo.  http://0.0.0.0:8000
	sphinx-autobuild --host 0.0.0.0 -b html $(SOURCEDIR) $(BUILDDIR)/html
	if errorlevel 1 exit /b 1
	goto end
)
if "%1" == "test" (
	echo.Running test script.
	echo.View results below.
	./scripts/build/test-docs.sh
	if errorlevel 1 exit /b 1
	goto end
)
if "%1" == "docker-html" (
	echo.Running test script in docker.
	echo.View results below.
	./scripts/build/docker-docs.sh make html
	if errorlevel 1 exit /b 1
	goto end
)
if "%1" == "docker-preview" (
	echo.Running sphinx-autobuild in docker.
	DOCKER_RUN_ARGS="-p 127.0.0.1:8000:8000" ./scripts/build/docker-docs.sh \

	if errorlevel 1 exit /b 1
	echo.
	echo.Build finished. View live edits at:
	echo.  http://127.0.0.1:8000/index.html
	goto end
)
if "%1" == "docker-test" (
	echo.Running test script in docker.
	echo.View results below.
	./scripts/build/build/docker-docs.sh ./scripts/build/test-docs.sh
	if errorlevel 1 exit /b 1
	goto end
)

:end
popd
