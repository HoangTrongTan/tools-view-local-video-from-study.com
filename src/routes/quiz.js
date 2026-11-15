'use strict';

/** Trắc nghiệm sau bài học: tạo bằng AI, nhập thủ công, lưu kết quả, câu nhắc lại. */

const { json, readBody } = require('../http/response');
const library = require('../services/library');
const provider = require('../services/ai/provider');
const { parseManualQuizResponse, validateQuiz } = require('../services/ai/quizFormat');
const quiz = require('../services/quiz/quizService');
const lessonFacts = require('../services/knowledge/lessonFacts');

module.exports = [
  { method: 'GET', path: '/api/quiz/status', handler: async ({ res }) => json(res, 200, await provider.aiStatus()) },
  {
    method: 'GET', path: '/api/quiz/job',
    async handler({ res, url }) {
      const file = await library.videoPath(url.searchParams.get('video'));
      const job = quiz.quizJobs.get(file) || { phase: 'idle', message: 'Chưa bắt đầu tạo câu hỏi.' };
      const pull = provider.currentPull();
      return json(res, 200, job.phase === 'pulling' && pull ? { ...job, ...pull } : job);
    }
  },
  {
    method: 'POST', path: '/api/quiz',
    async handler({ req, res }) {
      const { video } = await readBody(req);
      const file = await library.videoPath(video);
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) return json(res, 422, { error: 'Bài này chưa có file phụ đề .srt để tạo trắc nghiệm.' });
      const key = await quiz.quizKey(subtitle);
      const update = (phase, message, percent) => quiz.quizJobs.set(file, { phase, message, ...(percent === undefined ? {} : { percent }) });
      if (quiz.quizCache.has(key)) { update('done', 'Bài tập đã sẵn sàng.'); return json(res, 200, { questions: quiz.quizCache.get(key) }); }
      if (!quiz.quizPending.has(key)) {
        const work = (async () => {
          try {
            update('connecting', provider.usingGemini() ? 'Đang kết nối Gemini…' : 'Đang kết nối Ollama trên máy…');
            const model = await provider.readyModel(update);
            update('generating', 'Đang đọc phụ đề và tạo câu hỏi…');
            const questions = await quiz.createQuiz(file, subtitle, model, update);
            quiz.quizCache.set(key, questions);
            update('done', 'Bài tập đã sẵn sàng.');
            return questions;
          } catch (error) {
            update('error', error.message || 'Không tạo được bài tập.');
            throw error;
          } finally { quiz.quizPending.delete(key); }
        })();
        quiz.quizPending.set(key, work);
      }
      return json(res, 200, { questions: await quiz.quizPending.get(key) });
    }
  },
  {
    method: 'GET', path: '/api/quiz/manual',
    async handler({ res, url }) {
      const file = await library.videoPath(url.searchParams.get('video'));
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) throw new Error('Bài này chưa có phụ đề để tạo prompt.');
      return json(res, 200, { prompt: await quiz.manualQuizPrompt(file, subtitle) });
    }
  },
  {
    method: 'POST', path: '/api/quiz/manual',
    async handler({ req, res }) {
      const body = await readBody(req, 2 * 1024 * 1024);
      const file = await library.videoPath(body.video);
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) throw new Error('Bài này chưa có phụ đề.');
      if (typeof body.response !== 'string' || !body.response.trim()) throw new Error('Hãy dán JSON câu hỏi vào ô trả lời.');
      let raw;
      try { raw = parseManualQuizResponse(body.response); }
      catch { throw new Error('JSON chưa hoàn chỉnh. Hãy copy toàn bộ từ dấu { đầu đến dấu } cuối; đừng để dấu \\ ở cuối dòng hoặc chữ ngoài JSON.'); }
      const questions = validateQuiz(raw).map((item, index) => ({ ...item,
        ...(raw.questions[index].source === 'extension' ? { extension: true } : {}),
        ...(raw.questions[index].source === 'review' ? { reviewSource: 'manual' } : {})
      }));
      quiz.quizCache.set(await quiz.quizKey(subtitle), questions);
      quiz.quizJobs.set(file, { phase: 'done', message: 'Bài tập thủ công đã sẵn sàng.' });
      return json(res, 200, { questions });
    }
  },
  {
    method: 'POST', path: '/api/quiz/complete',
    async handler({ req, res }) {
      const body = await readBody(req);
      const file = await library.videoPath(body.video);
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) throw new Error('Không tìm thấy phụ đề của bài.');
      const questions = quiz.quizCache.get(await quiz.quizKey(subtitle));
      if (!questions) throw new Error('Bài trắc nghiệm đã hết hạn. Hãy tạo lại trước khi lưu kiến thức.');
      if (!Array.isArray(body.wrongQuestions) || body.wrongQuestions.some(item => typeof item !== 'string') || body.wrongQuestions.length > questions.length) throw new Error('Kết quả chấm bài không hợp lệ.');
      await lessonFacts.saveQuizResult(file, questions, body.wrongQuestions);
      return json(res, 200, { ok: true });
    }
  },
  {
    method: 'POST', path: '/api/quiz/remedial',
    async handler({ req, res }) {
      const body = await readBody(req);
      const file = await library.videoPath(body.video);
      const subtitle = await library.subtitlePath(file);
      if (!subtitle) return json(res, 422, { error: 'Bài này chưa có phụ đề để nhắc lại kiến thức.' });
      if (!Array.isArray(body.wrongQuestions) || body.wrongQuestions.length < 1 || body.wrongQuestions.length > 20)
        return json(res, 400, { error: 'Danh sách câu sai không hợp lệ.' });
      const wrongQuestions = body.wrongQuestions.map(item => ({
        question: typeof item.question === 'string' ? item.question.trim().slice(0, 500) : '',
        correctAnswer: typeof item.correctAnswer === 'string' ? item.correctAnswer.trim().slice(0, 300) : '',
        explanation: typeof item.explanation === 'string' ? item.explanation.trim().slice(0, 600) : ''
      }));
      if (wrongQuestions.some(item => !item.question || !item.correctAnswer || !item.explanation))
        return json(res, 400, { error: 'Thông tin câu sai chưa đầy đủ.' });
      const model = await provider.readyModel(() => {});
      return json(res, 200, { questions: await quiz.createRemedial(subtitle, model, wrongQuestions) });
    }
  }
];
