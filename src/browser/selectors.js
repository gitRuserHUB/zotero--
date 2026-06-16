export const FIELD_SELECTORS = Object.freeze({
  doi: [
    'input[name="doi"]',
    'input[id*="doi" i]',
    'input[placeholder*="DOI" i]',
  ],
  title: [
    'input[name="title"]',
    'textarea[name="title"]',
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
  ],
  authors: [
    'input[name="author"]',
    'input[name="authors"]',
    'textarea[name="authors"]',
    'input[placeholder*="作者"]',
  ],
  publicationTitle: [
    'input[name="journal"]',
    'input[name="publication"]',
    'input[placeholder*="期刊"]',
  ],
  year: ['input[name="year"]', 'input[placeholder*="年份"]'],
  url: [
    'input[name="url"]',
    'input[name="link"]',
    'input[placeholder*="网址"]',
    'input[placeholder*="链接"]',
  ],
});

export const QUERY_SELECTORS = Object.freeze([
  '[data-testid="doi-query"]',
  'button[name="doi-query"]',
  'button:not([type="submit"])',
  '[role="button"]',
  'button[type="button"]',
]);

export const QUERY_ERROR_SELECTORS = Object.freeze([
  '[data-testid="doi-error"]',
  '[role="alert"]',
  '.error-message',
]);
