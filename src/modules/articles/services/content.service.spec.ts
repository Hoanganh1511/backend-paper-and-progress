import { describe, expect, it } from 'vitest';
import {
  ContentService,
  estimateReadingMinutes,
  splitBlocks,
} from './content.service.js';

const config = {
  get: (key: string) =>
    ({
      CDN_BASE_URL: 'https://cdn.example.com',
      APP_URL: 'http://localhost:8000',
    })[key],
};
const service = new ContentService(config as never);

describe('ContentService.sanitize', () => {
  it('keeps a blank line the writer left on purpose: an empty paragraph, or one of spaces', () => {
    expect(service.sanitize('<p>a</p><p></p><p></p><p>b</p>')).toBe(
      '<p>a</p><p></p><p></p><p>b</p>',
    );
    expect(service.sanitize('<p>a</p><p>   </p><p>b</p>')).toBe(
      '<p>a</p><p>   </p><p>b</p>',
    );
  });

  it('removes scripts, event handlers and javascript: links', () => {
    const html = service.sanitize(
      '<p onclick="x()">Hi</p><script>alert(1)</script>' +
        '<a href="javascript:alert(1)">bad</a><img src="https://cdn.example.com/a.png" onerror="x()">',
    );
    expect(html).not.toMatch(/script|onclick|onerror|javascript:/i);
    expect(html).toContain('<p>Hi</p>');
    expect(html).toContain('src="https://cdn.example.com/a.png"');
  });

  it('only keeps images from our own storage', () => {
    const html = service.sanitize(
      '<img src="https://evil.example.org/x.png"><img src="http://localhost:8000/uploads/articles/a.png">',
    );
    expect(html).not.toContain('evil.example.org');
    expect(html).toContain('localhost:8000/uploads/articles/a.png');
  });

  it('forces rel on links and opens external ones in a new tab', () => {
    const html = service.sanitize('<a href="https://example.com">x</a>');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('keeps only the classes the editor and lowlight produce', () => {
    const html = service.sanitize(
      '<pre class="x"><code class="language-ts evil">a</code></pre><span class="hljs-keyword other">b</span>',
    );
    expect(html).toContain('class="language-ts"');
    expect(html).toContain('class="hljs-keyword"');
    expect(html).not.toMatch(/evil|other|class="x"/);
  });
});

describe('ContentService.process', () => {
  it('derives plain text and reading time, and highlights code blocks', () => {
    const result = service.process(
      '<h2>Title</h2><p>One two three.</p><pre><code class="language-js">const a = 1;</code></pre>',
    );
    expect(result.text).toContain('One two three.');
    expect(result.text).not.toContain('<');
    expect(result.readingMinutes).toBe(1);
    expect(result.html).toContain('hljs-keyword');
  });

  it('turns escaped characters in code back before highlighting, without double escaping', () => {
    const result = service.process(
      '<pre><code class="language-js">if (a &lt; b) {}</code></pre>',
    );
    expect(result.html).toContain('&#x3C;');
    expect(result.html).not.toContain('&amp;lt;');
  });
});

describe('estimateReadingMinutes', () => {
  it('is at least one minute and rounds up per 200 words', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes('word '.repeat(200))).toBe(1);
    expect(estimateReadingMinutes('word '.repeat(201))).toBe(2);
  });
});

describe('previewHtml', () => {
  const html =
    '<p>1</p><p>2</p><ul><li>a</li><li>b</li></ul><blockquote><p>q</p></blockquote>' +
    '<p>5</p><p>6</p><p>7</p><p>8</p><p>9</p><p>10</p>';

  it('splits into top-level blocks, nested tags stay whole', () => {
    expect(splitBlocks(html)).toHaveLength(10);
    expect(splitBlocks('<ul><li>a</li></ul><img src="x"><br><p>z</p>')).toEqual(
      ['<ul><li>a</li></ul>', '<img src="x">', '<br>', '<p>z</p>'],
    );
  });

  it('keeps the first 30% of blocks and never leaves a tag open', () => {
    const preview = service.previewHtml(html);
    expect(splitBlocks(preview)).toHaveLength(3);
    expect(preview).toBe('<p>1</p><p>2</p><ul><li>a</li><li>b</li></ul>');
    const opens = (preview.match(/<(?!\/)[a-z0-9]+/g) ?? []).length;
    const closes = (preview.match(/<\//g) ?? []).length;
    expect(opens).toBe(closes);
  });

  it('keeps at least one block', () => {
    expect(service.previewHtml('<p>only</p>')).toBe('<p>only</p>');
  });
});
