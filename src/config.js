'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');

const paths = {
  root,
  publicDir: path.join(root, 'public'),
  dataDir,
  stateFile: path.join(dataDir, 'progress.json'),
  contextsDir: path.join(dataDir, 'contexts'),
  legacyBackupDir: path.join(dataDir, 'legacy'),
  aiLogFile: path.join(dataDir, 'logs', 'ai-debug.jsonl'),
  geminiKeyFile: path.join(root, 'gemini-key.txt'),
  // Vị trí cũ trước khi tách module, chỉ dùng để tự chuyển dữ liệu.
  legacyStateFile: path.join(root, 'progress.json'),
  legacyContextFile: path.join(root, 'learning-context.json')
};

const host = '127.0.0.1';
const port = Number(process.env.PORT || 38473);

const ollamaPort = Number(process.env.OLLAMA_PORT || 11434);
if (!Number.isInteger(ollamaPort) || ollamaPort < 1 || ollamaPort > 65535) throw new Error('OLLAMA_PORT không hợp lệ.');
const ollamaUrl = `http://127.0.0.1:${ollamaPort}`;
const configuredModel = process.env.OLLAMA_MODEL?.trim() || 'qwen3:4b';

const geminiModels = [...new Set([
  process.env.GEMINI_MODEL?.trim(),
  'gemini-3.1-flash-lite',
  'gemma-4-31b-it',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-2.5-flash'
].filter(Boolean))];

function loadGeminiKey() {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const keyFile = fs.readFileSync(paths.geminiKeyFile, 'utf8').trim();
    return keyFile.match(/^\s*(?:GEMINI_)?API_KEY\s*=\s*(\S+)\s*$/mi)?.[1] || keyFile;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return '';
  }
}

const videoExts = new Set(['.mp4', '.webm', '.m4v', '.mov', '.ogg']);
const videoMime = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.ogg': 'video/ogg' };
const noteExts = new Set(['.md', '.txt']);

module.exports = {
  paths, host, port, ollamaUrl, configuredModel, geminiModels,
  geminiKey: loadGeminiKey(),
  videoExts, videoMime, noteExts
};
