'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');
const { paths, geminiKey } = require('../../config');

/** Ghi mỗi lần gọi AI vào data/logs/ai-debug.jsonl (API key luôn được che). */
async function logAiAttempt(entry) {
  try {
    let safe = JSON.stringify({ time: new Date().toISOString(), ...entry });
    if (geminiKey) safe = safe.replaceAll(geminiKey, '[REDACTED_KEY]');
    console.log('[AI]', safe);
    await fsp.mkdir(path.dirname(paths.aiLogFile), { recursive: true });
    await fsp.appendFile(paths.aiLogFile, safe + '\n', 'utf8');
  } catch (error) { console.error('Không ghi được log AI:', error.message); }
}

module.exports = { logAiAttempt };
