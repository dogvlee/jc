const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AuthorizedCatalogError,
  PUBLIC_ENDPOINTS,
  createAuthorizedCatalogClient,
  normalizeMaterial,
  normalizeBorder,
  mergeById,
  paginationFrom
} = require('../src/services/authorized-catalog');

function response(payload, options) {
  return {
    ok: !(options && options.ok === false),
    status: options && options.status != null ? options.status : 200,
    json: async () => payload
  };
}

function envelope(list, metadata) {
  return {
    code: 1,
    status_code: 1,
    message: '成功',
    data: Object.assign({ page: 1, limit: 100, total: list.length, list }, metadata)
  };
}

test('industry request uses only the authorised endpoint, headers and limit body', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return response(envelope([{
      id: 233730076,
      name: '价签-外套',
      width: 40,
      height: 60,
      thumbnail: 'https://cdn.example/template.png',
      marketingCategoryName: '服装零售',
      hasVipRes: true,
      elements: [{
        type: 'text', value: '浅蓝外套', x: 2, y: 2, width: 30, height: 6, fontSize: 3
      }, {
        type: 'image', imageUrl: 'https://cdn.example/coat.png', x: 2, y: 10, width: 8, height: 8
      }]
    }], { page: 2, limit: 25, total: 51 }));
  };
  const client = createAuthorizedCatalogClient({
    fetchImpl,
    baseUrl: 'https://catalog.example/api/',
    timeoutMs: 500
  });

  const page = await client.fetchIndustryTemplates({
    page: 2,
    limit: 25,
    width: 40,
    height: 60,
    languageCode: 'zh-cn'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://catalog.example/api/industryTemplate/page');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['niimbot-user-agent'], 'AppVersionName/6.6.6');
  assert.equal(calls[0].init.headers.lang, 'zh-cn');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    page: 2,
    limit: 25,
    width: 40,
    height: 60,
    languageCode: 'zh-cn'
  });

  assert.equal(page.items.length, 1);
  assert.equal(page.total, 51);
  assert.equal(page.totalPages, 3);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextPage, 3);
  assert.deepEqual(page.items[0].size, [40, 60]);
  assert.equal(page.items[0].id, 'online-233730076');
  assert.equal(page.items[0].source, 'authorized-niim');
  assert.equal(page.items[0].availability, 'remote');
  assert.equal(page.items[0].badge, 'VIP');
  assert.equal(page.items[0].thumbSrc, 'https://cdn.example/template.png');
  assert.equal(page.items[0].document.elements[0].text, '浅蓝外套');
  assert.equal(page.items[0].document.elements[1].path, 'https://cdn.example/coat.png');
  assert.equal(page.items[0].sourceMeta.remoteId, 233730076);
});

test('authorized records reject insecure remote image URLs', async () => {
  assert.throws(() => normalizeMaterial({ id: 1, image: 'http://cdn.example/material.png' }), /\u7f3a\u5c11\u56fe\u7247\u5730\u5740/);
  assert.throws(() => normalizeBorder({ id: 2, image: 'file:///tmp/border.png' }), /\u7f3a\u5c11\u56fe\u7247\u5730\u5740/);

  const client = createAuthorizedCatalogClient({
    fetchImpl: async () => response(envelope([{
      id: 3,
      name: '安全模板',
      width: 30,
      height: 20,
      thumbnail: 'http://cdn.example/thumb.png',
      elements: [{ type: 'image', imageUrl: 'http://cdn.example/image.png', x: 1, y: 1, width: 5, height: 5 }]
    }]))
  });
  const page = await client.fetchIndustryTemplates();
  assert.equal(page.items[0].thumbSrc, '');
  assert.equal(page.items[0].document.elements.some((element) => element.type === 'image'), false);
});

test('a malformed catalog record is skipped without failing its page', async () => {
  const client = createAuthorizedCatalogClient({
    fetchImpl: async () => response(envelope([
      { id: 1, name: '坏素材', image: 'http://cdn.example/bad.png' },
      { id: 2, name: '好素材', image: 'https://cdn.example/good.png' }
    ]))
  });
  const page = await client.fetchMaterials();
  assert.equal(page.received, 2);
  assert.equal(page.skipped, 1);
  assert.equal(page.itemCount, 1);
  assert.deepEqual(page.items.map((item) => item.id), ['niim-2']);
});

test('material and border pages keep remote assets, tags and nine-patch metadata', async () => {
  const calls = [];
  const replies = [
    envelope([{
      id: 5415,
      name: '通讯',
      materialIndustryId: 1,
      materialIndustryName: 'ALL',
      materialCategoryId: 1653,
      materialCategoryName: 'Logo',
      image: 'https://cdn.example/material.png',
      tags: ['通讯', 'Logo', '通讯'],
      vip: false
    }]),
    envelope([{
      id: 8558,
      name: '',
      borderIndustryId: 1669,
      borderIndustryName: '线框',
      borderCategoryId: 1726,
      borderCategoryName: '最新',
      image: 'https://cdn.example/border.png',
      vip: true,
      tags: ['节日'],
      ninePatch: {
        identity: true,
        previewUrl: 'https://cdn.example/border-preview.png',
        deformationMethod: ''
      }
    }])
  ];
  const client = createAuthorizedCatalogClient({
    timeoutMs: 500,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(replies.shift());
    }
  });

  const materials = await client.fetchMaterials({ page: 1, limit: 10, keyword: ' 通讯 ' });
  const borders = await client.fetchBorders({ page: 1, limit: 10, keyword: ' 节日 ' });

  assert.equal(calls[0].url.endsWith(PUBLIC_ENDPOINTS.materials), true);
  assert.equal(calls[1].url.endsWith(PUBLIC_ENDPOINTS.borders), true);
  assert.deepEqual(JSON.parse(calls[0].init.body), { page: 1, limit: 10, keyword: '通讯' });
  assert.deepEqual(JSON.parse(calls[1].init.body), { page: 1, limit: 10, keyword: '节日' });

  assert.deepEqual(materials.items[0], normalizeMaterial({
    id: 5415,
    name: '通讯',
    materialIndustryId: 1,
    materialIndustryName: 'ALL',
    materialCategoryId: 1653,
    materialCategoryName: 'Logo',
    image: 'https://cdn.example/material.png',
    tags: ['通讯', 'Logo', '通讯'],
    vip: false
  }));
  assert.equal(materials.items[0].id, 'niim-5415');
  assert.deepEqual(materials.items[0].tags, ['Logo', 'ALL', '通讯']);

  assert.deepEqual(borders.items[0].ninePatch, {
    identity: true,
    previewUrl: 'https://cdn.example/border-preview.png',
    deformationMethod: ''
  });
  assert.equal(borders.items[0].id, 'niim-border-8558');
  assert.equal(borders.items[0].type, 'image');
  assert.equal(borders.items[0].asset, 'https://cdn.example/border.png');
  assert.equal(borders.items[0].previewSrc, 'https://cdn.example/border-preview.png');
  assert.equal(borders.items[0].vip, true);
  assert.deepEqual(borders.items[0], normalizeBorder({
    id: 8558,
    name: '',
    borderIndustryId: 1669,
    borderIndustryName: '线框',
    borderCategoryId: 1726,
    borderCategoryName: '最新',
    image: 'https://cdn.example/border.png',
    vip: true,
    tags: ['节日'],
    ninePatch: {
      identity: true,
      previewUrl: 'https://cdn.example/border-preview.png',
      deformationMethod: ''
    }
  }));
});

test('schema, HTTP and API failures are typed catalog errors', async (t) => {
  await t.test('HTTP status', async () => {
    const client = createAuthorizedCatalogClient({
      fetchImpl: async () => response({}, { ok: false, status: 503 }),
      timeoutMs: 500
    });
    await assert.rejects(
      client.fetchMaterials(),
      (error) => error instanceof AuthorizedCatalogError && error.code === 'HTTP_ERROR' && error.details.status === 503
    );
  });

  await t.test('API code', async () => {
    const client = createAuthorizedCatalogClient({
      fetchImpl: async () => response({ code: 0, message: '参数错误', data: null }),
      timeoutMs: 500
    });
    await assert.rejects(
      client.fetchBorders(),
      (error) => error.code === 'API_ERROR' && /参数错误/.test(error.message)
    );
  });

  await t.test('missing list', async () => {
    const client = createAuthorizedCatalogClient({
      fetchImpl: async () => response({ code: 1, data: { page: 1, limit: 10, total: 0 } }),
      timeoutMs: 500
    });
    await assert.rejects(client.fetchMaterials(), (error) => error.code === 'INVALID_RESPONSE');
  });
});

test('timeout aborts a slow fetch and reports TIMEOUT', async () => {
  let aborted = false;
  const client = createAuthorizedCatalogClient({
    timeoutMs: 10,
    fetchImpl: async (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true;
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    })
  });

  await assert.rejects(client.fetchMaterials(), (error) => error.code === 'TIMEOUT');
  assert.equal(aborted, true);
});

test('merge and pagination helpers preserve bundled-first ids', () => {
  const bundled = [{ id: 'online-1', availability: 'offline' }, { id: 'base-1' }];
  const remote = [{ id: 'online-1', availability: 'remote' }, { id: 'online-2' }];
  assert.deepEqual(mergeById(bundled, remote), [bundled[0], bundled[1], remote[1]]);
  assert.deepEqual(paginationFrom({ page: 3, limit: 20, total: 61 }, 20), {
    page: 3,
    limit: 20,
    total: 61,
    totalPages: 4,
    hasMore: true,
    nextPage: 4,
    itemCount: 20
  });
  assert.equal(Object.isFrozen(PUBLIC_ENDPOINTS), true);
  assert.deepEqual(Object.values(PUBLIC_ENDPOINTS), [
    '/industryTemplate/page',
    '/materialLib/page',
    '/material-borders/page'
  ]);
});
