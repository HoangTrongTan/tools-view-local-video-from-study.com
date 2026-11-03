Option Explicit

Dim shell, folder, command, app
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
command = "node.exe " & Chr(34) & folder & "\server.js" & Chr(34)

On Error Resume Next
shell.Run command, 0, False
If Err.Number <> 0 Then
  MsgBox "Khong mo duoc Node.js. Hay cai Node.js va thu lai.", vbExclamation, "Goc hoc tap"
  WScript.Quit 1
End If
On Error GoTo 0

WScript.Sleep 1800
Set app = CreateObject("Shell.Application")
app.ShellExecute "http://127.0.0.1:38473", "", "", "open", 1
