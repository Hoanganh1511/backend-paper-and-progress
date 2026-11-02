import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toHtml } from 'hast-util-to-html';
import { common, createLowlight } from 'lowlight';
import sanitizeHtml from 'sanitize-html';

const lowlight = createLowlight(common);

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'mark',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const VOID_TAGS = new Set(['br', 'hr', 'img']);

export interface ProcessedContent {
  html: string;
  text: string;
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 200;

/** `Math.max(1, ceil(words / 200))`; the same formula as the web app's readingTime.ts. */
export function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * Splits well-formed HTML (already sanitized) into its top-level blocks. Never cuts
 * inside a tag, since sanitize-html escapes `<` and `>` inside attribute values.
 */
export function splitBlocks(html: string): string[] {
  const blocks: string[] = [];
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let depth = 0;
  let blockStart = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    const [whole, closing, name, selfClosing] = match;
    const isVoid = VOID_TAGS.has(name.toLowerCase()) || selfClosing === '/';
    if (closing) {
      depth -= 1;
    } else if (!isVoid) {
      depth += 1;
    }
    if (depth === 0) {
      const end = match.index + whole.length;
      blocks.push(html.slice(blockStart, end));
      blockStart = end;
    }
  }
  const rest = html.slice(blockStart).trim();
  if (rest) blocks.push(rest);
  return blocks.filter((block) => block.trim().length > 0);
}

/** Turns what the editor sends into safe HTML plus the plain text and reading time derived from it. */
@Injectable()
export class ContentService {
  private readonly imagePrefixes: string[];

  constructor(config: ConfigService) {
    const bucket = config.get<string>('AWS_S3_BUCKET');
    this.imagePrefixes = [
      config.get<string>('CDN_BASE_URL'),
      config.get<string>('APP_URL'),
      bucket
        ? `https://${bucket}.s3.${config.get<string>('AWS_REGION') ?? 'ap-southeast-1'}.amazonaws.com`
        : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/+$/, '') + '/');
  }

  process(rawHtml: string): ProcessedContent {
    const html = this.highlightCode(this.sanitize(rawHtml));
    const text = this.toText(html);
    return { html, text, readingMinutes: estimateReadingMinutes(text) };
  }

  /** Keeps only what the editor can produce; images only from our own storage. */
  sanitize(rawHtml: string): string {
    return sanitizeHtml(rawHtml, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: {
        a: ['href', 'rel', 'target'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        code: ['class'],
        span: ['class'],
        th: ['colspan', 'rowspan'],
        td: ['colspan', 'rowspan'],
      },
      allowedClasses: {
        code: ['language-*'],
        span: ['hljs-*'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      allowProtocolRelative: false,
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer',
            ...(attribs.href?.startsWith('http') ? { target: '_blank' } : {}),
          },
        }),
      },
      exclusiveFilter: (frame) =>
        frame.tag === 'img' &&
        !this.imagePrefixes.some((prefix) =>
          (frame.attribs.src ?? '').startsWith(prefix),
        ),
    });
  }

  /** Colours `<pre><code>` blocks with lowlight so the reader needs no JavaScript. */
  highlightCode(html: string): string {
    return html.replace(
      /<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,
      (_whole, language: string | undefined, escaped: string) => {
        const code = decodeEntities(escaped);
        try {
          const tree =
            language && lowlight.registered(language)
              ? lowlight.highlight(language, code)
              : lowlight.highlightAuto(code);
          const className = language ? ` class="language-${language}"` : '';
          return `<pre><code${className}>${toHtml(tree)}</code></pre>`;
        } catch {
          return `<pre><code>${escaped}</code></pre>`;
        }
      },
    );
  }

  toText(html: string): string {
    const spaced = html.replace(
      /<\/(p|h[1-6]|li|pre|blockquote|tr)>|<br\s*\/?>/gi,
      '\n',
    );
    const stripped = sanitizeHtml(spaced, {
      allowedTags: [],
      allowedAttributes: {},
    });
    return decodeEntities(stripped)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
  }

  /** The first `ratio` of the top-level blocks (at least one); never cuts inside a tag. */
  previewHtml(html: string, ratio = 0.3): string {
    const blocks = splitBlocks(html);
    const keep = Math.max(1, Math.ceil(blocks.length * ratio));
    return blocks.slice(0, keep).join('');
  }
}
