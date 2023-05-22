Summary: F5 Application Services 3.0 Extension
Version: %{_version}
Name: %{_name}
Release: %{_release}
BuildArch: noarch
Group: Development/Tools
License: Commercial
Packager: F5 Networks <support@f5.com>

%description
Application Services 3.0 declarative configuration method for BIG-IP

%define IAPP_INSTALL_DIR /var/config/rest/iapps/%{name}
%define PKGS_DIR /var/config/rest/iapps/%{name}/packages
%define _unpackaged_files_terminate_build 0

%prep
cp -r %{main}/src/ %{_builddir}/src/
rm -rf %{_builddir}/src/schema/latest/*
cp %{main}/src/schema/latest/adc-schema.json %{_builddir}/src/schema/latest/
cp %{main}/src/schema/latest/as3-request-schema.json %{_builddir}/src/schema/latest/
cp %{main}/src/schema/latest/settings-schema.json %{_builddir}/src/schema/latest/
cp %{main}/src/schema/latest/app-schema.json %{_builddir}/src/schema/latest/
cp -r %{_topdir}/pkgs/ %{_builddir}/pkgs/
cp %{main}/package*.json %{_builddir}/src
%if "%{_perf_tracing_enabled}" == "true"
    npm ci --only=prod --prefix %{_builddir}/src
%else
    npm ci --only=prod --prefix %{_builddir}/src --no-optional
%endif
printf "%s" "%{version}-%{release}" > %{_builddir}/src/version
printf "%s" "%{_cloudver}" > %{_builddir}/src/cloudVer

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
cp -r %{_builddir}/src/* $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}
mkdir -p $RPM_BUILD_ROOT%{PKGS_DIR}
cp -r %{_builddir}/pkgs/* $RPM_BUILD_ROOT%{PKGS_DIR}
$(cd $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}/schema; ln -s latest/*.json .)
mv $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}/nodejs/manifest.json $RPM_BUILD_ROOT%{IAPP_INSTALL_DIR}

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)
%{IAPP_INSTALL_DIR}
