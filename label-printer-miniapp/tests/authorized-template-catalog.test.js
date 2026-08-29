const test = require('node:test');
const assert = require('node:assert/strict');

const {
  API_URL,
  BORDER_API_URL,
  MATERIAL_API_URL,
  PAGE_LIMIT,
  fetchAuthorizedBorderPage,
  fetchAuthorizedMaterialPage,
  fetchAuthorizedTemplatePage,
  mergeRemoteTemplates,
  normalizeCatalogResponse
} = require('../miniprogram/services/authorized-template-catalog');

function rawTemplate(id, overrides = {}) {
  return Object.assign({
    id,
    name: `在线模板 ${id}`,
    width: 50,
    height: 30,
    thumbnail: `https://oss-print.niimbot.com/public_resources/templates/${id}/thumb.png`,
    elements: [
      { id: `text-${id}`, type: 'text', x: 1, y: 1, width: 20, height: 4, value: '在线文字' },
      {
        id: `image-${id}`,
        type: 'image',
        x: 22,
        y: 2,
        width: 8,
        height: 8,
        imageUrl: `https://oss-niimbot-print.niimbot.com/assets/${id}.png`
      }
    ]
  }, overrides);
}

test('authorized catalog sends the exact public page request and converts documents', async () => {
  let requestOptions;
  const wxMock = {
    request(options) {
      requestOptions = options;
      options.success({
        statusCode: 200,
        data: {
          code: 1,
          message: '成功',
          data: { page: 2, limit: 100, total: 9161, list: [rawTemplate(512427651)] }
        }
      });
    }
  };

  const page = await fetchAuthorizedTemplatePage(wxMock, { page: 2 });
  assert.equal(requestOptions.url, API_URL);
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.header['niimbot-user-agent'], 'AppVersionName/6.6.6');
  assert.equal(requestOptions.header.lang, 'zh-cn');
  assert.deepEqual(requestOptions.data, {
    languageCode: 'zh-cn',
    width: 999,
    height: 999,
    page: 2,
    limit: PAGE_LIMIT
  });
  assert.equal(page.total, 9161);
  assert.equal(page.hasMore, true);
  assert.equal(page.templates[0].id, 'online-512427651');
  assert.equal(page.templates[0].source, 'remote-niim');
  assert.equal(page.templates[0].thumbSrc.startsWith('https://'), true);
  const image = page.templates[0].document.elements.find((element) => element.type === 'image');
  assert.equal(image.path, 'https://oss-niimbot-print.niimbot.com/assets/512427651.png');
});

test('catalog normalization skips malformed records and surfaces API errors', () => {
  const result = normalizeCatalogResponse({
    code: 1,
    data: { page: 1, limit: 100, total: 2, list: [null, rawTemplate(9)] }
  });
  assert.equal(result.received, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.templates.length, 1);
  assert.throws(
    () => normalizeCatalogResponse({ code: 0, message: '拒绝访问' }),
    /拒绝访问/
  );
});

test('remote pages deduplicate by source id and never replace bundled templates', () => {
  const first = normalizeCatalogResponse({
    code: 1,
    data: { page: 1, limit: 100, total: 3, list: [rawTemplate(1), rawTemplate(2)] }
  }).templates;
  const second = normalizeCatalogResponse({
    code: 1,
    data: { page: 2, limit: 100, total: 3, list: [rawTemplate(2), rawTemplate(3)] }
  }).templates;
  const merged = mergeRemoteTemplates(first, second, { reservedIds: ['online-1'] });
  assert.deepEqual(merged.map((item) => item.sourceId), ['2', '3']);
});

test('catalog request rejects network and HTTP failures clearly', async () => {
  await assert.rejects(
    fetchAuthorizedTemplatePage({ request: (options) => options.fail({ errMsg: 'request:fail timeout' }) }),
    /timeout/
  );
  await assert.rejects(
    fetchAuthorizedTemplatePage({ request: (options) => options.success({ statusCode: 503, data: {} }) }),
    /HTTP 503/
  );
});

test('authorized material pages use the public endpoint and preserve remote image metadata', async () => {
  let requestOptions;
  const wxMock = {
    request(options) {
      requestOptions = options;
      options.success({
        statusCode: 200,
        data: {
          code: 1,
          data: {
            page: 1,
            limit: 100,
            total: 2567,
            list: [{
              id: 5415,
              name: '通讯',
              materialIndustryName: 'ALL',
              materialCategoryName: 'Logo',
              image: 'https://oss-print.niimbot.com/public_resources/material/logo.png',
              tags: ['通讯', 'Logo'],
              vip: false
            }]
          }
        }
      });
    }
  };
  const page = await fetchAuthorizedMaterialPage(wxMock);
  assert.equal(requestOptions.url, MATERIAL_API_URL);
  assert.deepEqual(requestOptions.data, { page: 1, limit: PAGE_LIMIT });
  assert.equal(requestOptions.header.Authorization, undefined);
  assert.equal(page.total, 2567);
  assert.equal(page.materials[0].id, 'niim-5415');
  assert.equal(page.materials[0].source, 'remote-niim-material');
  assert.match(page.materials[0].asset, /^https:\/\//);
});

test('authorized border pages retain nine-patch previews without VIP authentication', async () => {
  let requestOptions;
  const wxMock = {
    request(options) {
      requestOptions = options;
      options.success({
        statusCode: 200,
        data: {
          code: 1,
          data: {
            page: 2,
            limit: 100,
            total: 632,
            list: [{
              id: 8558,
              name: '',
              borderIndustryName: '线框',
              borderCategoryName: '最新',
              image: 'https://oss-print.niimbot.com/public_resources/material/border.png',
              ninePatch: {
                identity: true,
                previewUrl: 'https://oss-print.niimbot.com/public_resources/images/border-preview.png'
              },
              vip: false
            }]
          }
        }
      });
    }
  };
  const page = await fetchAuthorizedBorderPage(wxMock, { page: 2 });
  assert.equal(requestOptions.url, BORDER_API_URL);
  assert.deepEqual(requestOptions.data, { page: 2, limit: PAGE_LIMIT });
  assert.equal(requestOptions.header.Cookie, undefined);
  assert.equal(page.total, 632);
  assert.equal(page.borders[0].id, 'niim-border-8558');
  assert.equal(page.borders[0].ninePatch.identity, true);
  assert.match(page.borders[0].previewSrc, /border-preview\.png$/);
});
