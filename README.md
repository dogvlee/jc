# JC Label Printing Workspace

This repository is the parent workspace for the label printing projects.

## Projects

- `label-printer-app`: Capacitor Android/Web label editor, linked as a Git
  submodule to `dogvlee/label-printer-app`.
- `label-printer-miniapp`: WeChat Mini Program implementation of the label
  editor and Bluetooth printing workflow.

## Clone

```powershell
git clone --recurse-submodules https://github.com/dogvlee/jc.git
cd jc
```

For an existing clone without submodules:

```powershell
git submodule update --init --recursive
```

Each project has its own setup and validation instructions.

## Local-Only Inputs

Original APK/XAPK packages, extracted third-party application assets, local
SDK/toolchain caches, emulator data, dependency folders, and build artifacts
are intentionally excluded. They are not required to clone or build the
clean-room source projects and should not be published in this repository.
