// Renders question text with inline $...$ math via KaTeX. Server-safe; escapes everything else.

import katex from 'katex';
import 'katex/dist/katex.min.css';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderMath(text: string): string {
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.length > 2 && part.startsWith('$') && part.endsWith('$')
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' })
        : escape(part),
    )
    .join('');
}

export function MathText({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />;
}
