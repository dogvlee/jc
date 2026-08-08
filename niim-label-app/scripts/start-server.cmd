@echo off
cd /d "E:\项目\jc\label-printer-app"
start "" /b "C:\Program Files\nodejs\node.exe" scripts\serve.mjs 1>artifacts\server.out.log 2>artifacts\server.err.log
