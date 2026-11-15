'use strict';

/** Hộp thoại chọn thư mục / file của Windows (chạy qua PowerShell). */

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { state } = require('../state/appState');

const execFileAsync = promisify(execFile);

async function runDialog(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: false, env: { ...process.env, VIDEO_TOOL_LAST_FOLDER: state.folder } });
  return stdout.trim();
}

async function chooseFolder() {
  if (process.platform !== 'win32') throw new Error('Nút chọn thư mục chỉ hỗ trợ Windows.');
  return runDialog(`Add-Type -AssemblyName System.Windows.Forms\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$dialog = New-Object System.Windows.Forms.FolderBrowserDialog\n$dialog.Description = 'Chọn thư mục chứa video'\n$last = [Environment]::GetEnvironmentVariable('VIDEO_TOOL_LAST_FOLDER')\nif ($last -and (Test-Path -LiteralPath $last -PathType Container)) { $dialog.SelectedPath = $last }\nif ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }`);
}

async function chooseNoteFile() {
  if (process.platform !== 'win32') throw new Error('Nút chọn file chỉ hỗ trợ Windows.');
  return runDialog(`Add-Type -AssemblyName System.Windows.Forms\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$dialog = New-Object System.Windows.Forms.OpenFileDialog\n$dialog.Title = 'Chon file ghi chu'\n$dialog.Filter = 'Ghi chu (*.md;*.txt)|*.md;*.txt|Tat ca file|*.*'\n$last = [Environment]::GetEnvironmentVariable('VIDEO_TOOL_LAST_FOLDER')\nif ($last -and (Test-Path -LiteralPath $last -PathType Container)) { $dialog.InitialDirectory = $last }\nif ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) }`);
}

module.exports = { chooseFolder, chooseNoteFile, execFileAsync };
