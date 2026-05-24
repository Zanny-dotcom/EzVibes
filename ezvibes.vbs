Option Explicit

Dim shell, fso, appDir, electronExe

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = appDir & "\node_modules\electron\dist\electron.exe"

If Not fso.FileExists(electronExe) Then
  MsgBox "Electron is not installed. Run npm install in " & appDir & " first.", vbExclamation, "ezvibes"
  WScript.Quit 1
End If

shell.CurrentDirectory = appDir
shell.Run """" & electronExe & """ .", 1, False
