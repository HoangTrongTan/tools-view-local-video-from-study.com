'use strict';

/** Hộp thoại chọn thư mục / file của Windows (chạy qua PowerShell). */

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { state } = require('../state/appState');

const execFileAsync = promisify(execFile);

/**
 * Hộp thoại do tiến trình nền mở sẽ bị Windows đẩy ra sau trình duyệt.
 * Gắn nó vào một cửa sổ ẩn TopMost để hộp thoại luôn nổi lên trên cùng.
 */
const ownerSetup = `$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.FormBorderStyle = 'None'
$owner.Opacity = 0
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Show()
$owner.Activate()`;

let dialogOpen = false;

async function runDialog(createDialog, resultProperty, dialogName) {
  if (dialogOpen) throw new Error(`Hộp thoại ${dialogName} đang mở. Hãy chọn hoặc đóng hộp thoại đó trước.`);
  dialogOpen = true;
  try {
    const script = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${createDialog}
${ownerSetup}
try { $result = $dialog.ShowDialog($owner) } finally { $owner.Close(); $owner.Dispose() }
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.${resultProperty}) }`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: false, env: { ...process.env, VIDEO_TOOL_LAST_FOLDER: state.folder } });
    return stdout.trim();
  } finally { dialogOpen = false; }
}

async function chooseFolder() {
  if (process.platform !== 'win32') throw new Error('Nút chọn thư mục chỉ hỗ trợ Windows.');
  return runDialog(`$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Chọn thư mục chứa video'
$last = [Environment]::GetEnvironmentVariable('VIDEO_TOOL_LAST_FOLDER')
if ($last -and (Test-Path -LiteralPath $last -PathType Container)) { $dialog.SelectedPath = $last }`, 'SelectedPath', 'chọn thư mục');
}

async function chooseNoteFile() {
  if (process.platform !== 'win32') throw new Error('Nút chọn file chỉ hỗ trợ Windows.');
  return runDialog(`$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Chon file ghi chu'
$dialog.Filter = 'Ghi chu (*.md;*.txt)|*.md;*.txt|Tat ca file|*.*'
$last = [Environment]::GetEnvironmentVariable('VIDEO_TOOL_LAST_FOLDER')
if ($last -and (Test-Path -LiteralPath $last -PathType Container)) { $dialog.InitialDirectory = $last }`, 'FileName', 'chọn file');
}

module.exports = { chooseFolder, chooseNoteFile, execFileAsync };
