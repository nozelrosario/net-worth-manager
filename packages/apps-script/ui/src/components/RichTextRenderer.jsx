import React, { useMemo } from 'react';

/**
 * Parses inline formatting: **bold**, `code`, *italic*
 */
function parseInline(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', val: text.substring(lastIdx, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      parts.push({ type: 'bold', val: raw.slice(2, -2) });
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      parts.push({ type: 'code', val: raw.slice(1, -1) });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      parts.push({ type: 'italic', val: raw.slice(1, -1) });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push({ type: 'text', val: text.substring(lastIdx) });
  }

  return parts.map((p, idx) => {
    if (p.type === 'bold') {
      return (
        <strong key={idx} className="font-semibold text-text-primary">
          {p.val}
        </strong>
      );
    }
    if (p.type === 'code') {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-surface-layer2/80 text-primary-accent border border-white/[0.08] text-typ-caption font-mono">
          {p.val}
        </code>
      );
    }
    if (p.type === 'italic') {
      return (
        <em key={idx} className="italic text-text-secondary">
          {p.val}
        </em>
      );
    }
    return <span key={idx}>{p.val}</span>;
  });
}

/**
 * Parses markdown into structured blocks
 */
function parseMarkdownBlocks(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const blocks = [];
  let currentList = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
    } else if (line.startsWith('## ')) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
    } else if (line.startsWith('# ')) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
    } else if (line.startsWith('>')) {
      // Blockquote / Callout
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'quote', text: line.replace(/^>\s*/, '') });
    } else if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      // Bullet list item
      const itemText = line.replace(/^[•\-\*]\s+/, '');
      if (!currentList || currentList.type !== 'bullet') {
        if (currentList) blocks.push(currentList);
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(itemText);
    } else if (/^\d+\.\s+/.test(line)) {
      // Numbered list item
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (!currentList || currentList.type !== 'numbered') {
        if (currentList) blocks.push(currentList);
        currentList = { type: 'numbered', items: [] };
      }
      currentList.items.push({ num: numMatch[1], text: numMatch[2] });
    } else if (line.startsWith('|') && line.endsWith('|')) {
      // Table row (ignore delimiter rows like |---|---|)
      if (line.includes('---')) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());
      if (!currentList || currentList.type !== 'table') {
        if (currentList) blocks.push(currentList);
        currentList = { type: 'table', rows: [] };
      }
      currentList.rows.push(cells);
    } else {
      // Regular paragraph
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'p', text: line });
    }
  }

  if (currentList) blocks.push(currentList);
  return blocks;
}

/**
 * RichTextRenderer: Converts markdown strings into sleek, responsive OLED-friendly styled components
 */
export default function RichTextRenderer({ content = '', className = '' }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

  if (!content) return null;

  return (
    <div className={`space-y-3.5 text-typ-footnote ${className}`}>
      {blocks.map((block, bIdx) => {
        // H1 / H2 / H3 Headings
        if (block.type === 'h3' || block.type === 'h2' || block.type === 'h1') {
          return (
            <div 
              key={bIdx} 
              className="pt-3 pb-1 border-b border-white/[0.08] mt-4 first:mt-0 flex items-center justify-between"
            >
              <h4 className="text-typ-body-sm font-bold text-text-primary tracking-tight flex items-center gap-2">
                {parseInline(block.text)}
              </h4>
            </div>
          );
        }

        // Callout Quote
        if (block.type === 'quote') {
          return (
            <div 
              key={bIdx} 
              className="my-2 p-3 rounded-xl bg-primary-accent/10 border-l-4 border-primary-accent text-text-primary text-typ-footnote leading-relaxed shadow-sm flex items-start gap-2.5"
            >
              <span className="text-primary-accent font-bold">💡</span>
              <div className="flex-1">
                {parseInline(block.text)}
              </div>
            </div>
          );
        }

        // Bullet List
        if (block.type === 'bullet') {
          return (
            <div key={bIdx} className="space-y-2 py-0.5">
              {block.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-start gap-2 text-text-secondary leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald shadow-[0_0_6px_rgba(16,185,129,0.4)] shrink-0 mt-2" />
                  <div className="flex-1">
                    {parseInline(item)}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Numbered List
        if (block.type === 'numbered') {
          return (
            <div key={bIdx} className="space-y-2 py-0.5">
              {block.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-start gap-2.5 text-text-secondary leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-surface-layer2 border border-white/[0.1] text-primary-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.num}
                  </span>
                  <div className="flex-1 pt-0.5">
                    {parseInline(item.text)}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Table
        if (block.type === 'table') {
          const [header, ...rows] = block.rows;
          return (
            <div key={bIdx} className="overflow-x-auto my-2 rounded-xl border border-white/[0.08] bg-surface-layer2/40">
              <table className="w-full text-left border-collapse text-typ-caption">
                {header && (
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-surface-layer2/80">
                      {header.map((col, cIdx) => (
                        <th key={cIdx} className="p-2 font-bold text-text-primary whitespace-nowrap">
                          {parseInline(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 text-text-secondary whitespace-nowrap">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Regular Paragraph
        return (
          <p key={bIdx} className="text-text-secondary leading-relaxed">
            {parseInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
