'use strict';

const { json, readBody } = require('../http/response');
const { state } = require('../state/appState');
const { courseExamPlan, createCourseExamPage } = require('../services/quiz/courseExam');

module.exports = [
  {
    method: 'GET', path: '/api/course-exam/plan',
    async handler({ res }) {
      if (!state.folder) throw new Error('Hãy chọn thư mục khóa học trước.');
      const plan = await courseExamPlan(state.folder);
      return json(res, 200, { revision: plan.revision, pages: plan.pages, facts: plan.facts.length });
    }
  },
  {
    method: 'POST', path: '/api/course-exam/page',
    async handler({ req, res }) {
      if (!state.folder) throw new Error('Hãy chọn thư mục khóa học trước.');
      const { page, revision } = await readBody(req);
      const plan = await courseExamPlan(state.folder);
      if (revision !== plan.revision) throw new Error('Kiến thức khóa học đã thay đổi. Hãy mở lại đề cuối khóa.');
      if (!Number.isInteger(page) || page < 0 || page >= plan.pages) throw new Error('Trang đề không hợp lệ.');
      return json(res, 200, { page, pages: plan.pages, questions: await createCourseExamPage(plan, page) });
    }
  }
];
