'use strict';

/** Kết nối model AI: Gemini (khi có API key, tự chuyển model dự phòng) hoặc Ollama trên máy. */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ollamaUrl, configuredModel, geminiModels, geminiKey } = require('../../config');
const { logAiAttempt } = require('./aiLog');
const { normalizeAiResult } = require('./quizFormat');

let activeGeminiModel = geminiModels[0];
const geminiUnavailableUntil = new Map();
let pullPending;
let pullProgress = { phase: 'pulling', message: 'Đang tải model AI về máy…' };

const usingGemini = () => Boolean(geminiKey);

async function installedModels() {
  const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error('Ollama không phản hồi.');
  const data = await response.json();
  return (Array.isArray(data.models) ? data.models : [])
    .map(item => item.name || item.model).filter(name => typeof name === 'string');
}

async function ollamaExecutable() {
  if (process.platform !== 'win32') return 'ollama';
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Ollama', 'ollama.exe')
  ];
  for (const candidate of candidates) {
    try { await fsp.access(candidate, fs.constants.X_OK); return candidate; } catch {}
  }
  return null;
}

async function aiStatus() {
  if (geminiKey) return { available: true, model: activeGeminiModel, models: geminiModels, provider: 'gemini' };
  try {
    const models = await installedModels();
    return { available: true, model: configuredModel, needsDownload: !models.includes(configuredModel) };
  } catch {
    const executable = await ollamaExecutable();
    return executable
      ? { available: true, model: configuredModel, needsDownload: true, needsStart: true }
      : { available: false, model: configuredModel, reason: 'Chưa cài Ollama trên máy.' };
  }
}

async function ensureOllamaRunning(update) {
  try { return await installedModels(); } catch {}
  const executable = await ollamaExecutable();
  if (!executable) throw new Error('Chưa tìm thấy Ollama trên máy. Hãy cài Ollama rồi thử lại.');
  update('connecting', 'Đang khởi động Ollama trên máy…');
  const child = spawn(executable, ['serve'], { detached: true, windowsHide: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try { return await installedModels(); } catch {}
  }
  throw new Error('Không khởi động được Ollama. Hãy mở ứng dụng Ollama rồi thử lại.');
}

async function pullModel(model, update) {
  if (!pullPending) {
    pullPending = (async () => {
      pullProgress = { phase: 'pulling', message: `Đang tải ${model} về máy…` };
      const response = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30 * 60 * 1000),
        body: JSON.stringify({ model, stream: true })
      });
      if (!response.ok || !response.body) throw new Error(`Không tải được model: Ollama trả lỗi ${response.status}.`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        if (done && buffer.trim()) lines.push(buffer);
        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }
          if (event.error) throw new Error(`Ollama: ${event.error}`);
          if (event.status === 'success') completed = true;
          const percent = event.total > 0 ? Math.round(event.completed / event.total * 100) : undefined;
          pullProgress = { phase: 'pulling', message: event.status ? `Đang tải ${model}: ${event.status}` : `Đang tải ${model}…`, ...(Number.isFinite(percent) ? { percent } : {}) };
        }
        if (done) break;
      }
      if (!completed && !(await installedModels()).includes(model)) throw new Error('Ollama chưa tải xong model. Hãy thử lại.');
    })().finally(() => { pullPending = undefined; });
  }
  update('pulling', `Đang tải ${model} về máy…`);
  return pullPending;
}

/** Tiến độ tải model Ollama (chỉ có khi đang tải). */
const currentPull = () => pullPending ? pullProgress : null;

async function readyModel(update) {
  if (geminiKey) { update('connecting', 'Đang kết nối Gemini…'); return 'gemini:auto'; }
  const models = await ensureOllamaRunning(update);
  if (!models.includes(configuredModel)) await pullModel(configuredModel, update);
  return configuredModel;
}

async function generateWithGemini(prompt, maxOutput, onAttempt) {
  const candidates = [activeGeminiModel, ...geminiModels.filter(name => name !== activeGeminiModel)];
  const available = candidates.filter(name => (geminiUnavailableUntil.get(name) || 0) <= Date.now());
  const attempts = available.length ? available : candidates;
  const failures = [];
  for (const [index, name] of attempts.entries()) {
    let responseText;
    let responseStatus;
    try {
      onAttempt?.(name, index + 1, attempts.length);
      const generationConfig = { temperature: 0.2, maxOutputTokens: maxOutput,
        ...(name.startsWith('gemma-') ? { thinkingConfig: { thinkingLevel: 'minimal' } }
          : { responseMimeType: 'application/json',
            ...(name === 'gemini-3.1-flash-lite' ? { thinkingConfig: { thinkingBudget: 0 } } : {}) }) };
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        signal: AbortSignal.timeout(maxOutput > 3000 ? 60000 : 30000),
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig })
      });
      responseStatus = response.status;
      responseText = await response.text();
      if (response.status === 401) throw Object.assign(new Error('API key Gemini không hợp lệ.'), { fatal: true });
      if (!response.ok) throw Object.assign(new Error('Gemini HTTP error'), { httpStatus: response.status });
      const data = JSON.parse(responseText);
      const output = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
      if (!output) throw new Error('Không có nội dung');
      const result = normalizeAiResult(JSON.parse(output.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')));
      await logAiAttempt({ model: name, status: responseStatus, response: responseText });
      activeGeminiModel = name;
      geminiUnavailableUntil.delete(name);
      return result;
    } catch (error) {
      const reason = error.httpStatus ? `HTTP ${error.httpStatus}`
        : error.name === 'TimeoutError' ? 'timeout'
          : error instanceof SyntaxError ? 'JSON không hợp lệ' : 'lỗi kết nối hoặc phản hồi';
      await logAiAttempt({ model: name, status: responseStatus ?? null, error: reason, response: responseText ?? null });
      if (error.fatal) throw error;
      failures.push(`${name}: ${reason}`);
      geminiUnavailableUntil.set(name, Date.now() + 60000);
    }
  }
  throw new Error(`Các model Gemini đều lỗi (${failures.join('; ')}). Hãy thử lại sau.`);
}

async function generateJson(model, prompt, maxOutput = 2300, { onAttempt } = {}) {
  if (model.startsWith('gemini:')) return generateWithGemini(prompt, maxOutput, onAttempt);
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(300000),
    body: JSON.stringify({ model, prompt, format: 'json', stream: false, think: false,
      options: { temperature: 0.2, num_ctx: 16384, num_predict: maxOutput } })
  });
  if (!response.ok) throw new Error(`Ollama trả lỗi ${response.status}.`);
  const data = await response.json();
  if (typeof data.response !== 'string') throw new Error('Model không trả về nội dung.');
  try { return normalizeAiResult(JSON.parse(data.response.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))); }
  catch { throw new Error('Model trả về JSON không hợp lệ. Hãy thử tạo lại bài tập.'); }
}

module.exports = { usingGemini, aiStatus, readyModel, generateJson, currentPull };
