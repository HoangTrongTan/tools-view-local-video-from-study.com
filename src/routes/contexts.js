'use strict';

/** Bộ kiến thức: liệt kê, tạo mới, đổi tên/loại và chọn bộ đang dùng. */

const { json, readBody } = require('../http/response');
const store = require('../services/knowledge/contextStore');
const selection = require('../services/knowledge/selection');
const library = require('../services/library');

module.exports = [
  {
    method: 'GET', path: '/api/contexts',
    async handler({ res }) {
      return json(res, 200, { contexts: await store.listContexts(), selected: await selection.activeContextId() });
    }
  },
  {
    method: 'POST', path: '/api/contexts',
    async handler({ req, res }) {
      const created = await selection.createAndSelect(await readBody(req));
      return json(res, 200, { context: created, state: await library.snapshot() });
    }
  },
  {
    method: 'POST', path: '/api/contexts/update',
    async handler({ req, res }) {
      const { id, name, type, description } = await readBody(req);
      const updated = await store.updateContextMeta(id, { name, type, description });
      return json(res, 200, { context: updated, state: await library.snapshot() });
    }
  },
  {
    method: 'POST', path: '/api/contexts/select',
    async handler({ req, res }) {
      await selection.selectContext((await readBody(req)).id);
      return json(res, 200, await library.snapshot());
    }
  }
];
