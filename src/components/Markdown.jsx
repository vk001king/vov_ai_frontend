import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

/* ============================================================
   Markdown renderer

   The original UI printed raw text, so every code block the model
   returned came out unreadable. This renders headings, lists,
   tables, inline formatting and fenced code blocks with a copy
   button, with no extra npm dependency to install.
   ============================================================ */

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (non-https origin) */
    }
  }

  return (
    <div className="codeBlock">
      <div className="codeBlockHeader">
        <span className="codeLang">{language || "code"}</span>

        <button className="codeCopy" onClick={copy} title="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* Inline: `code`, **bold**, *italic*, [text](url) */
function renderInline(text, keyPrefix) {
  const pattern =
    /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-i${index++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code className="inlineCode" key={key}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const label = token.slice(1, token.indexOf("]"));
      const href = token.slice(token.indexOf("(") + 1, -1);

      nodes.push(
        <a key={key} href={href} target="_blank" rel="noreferrer noopener">
          {label}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes.length ? nodes : text;
}

function renderTable(rows, key) {
  const cells = (line) =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const header = cells(rows[0]);
  const body = rows.slice(2).map(cells);

  return (
    <div className="mdTableWrap" key={key}>
      <table className="mdTable">
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={index}>{renderInline(cell, `${key}-h${index}`)}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Markdown({ text }) {
  if (!text) return null;

  const lines = String(text).split("\n");
  const blocks = [];

  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    /* ---- fenced code ---- */
    const fence = line.match(/^\s*```([a-zA-Z0-9+#.-]*)\s*$/);

    if (fence) {
      const language = fence[1];
      const code = [];

      index++;

      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index++;
      }

      index++; // consume the closing fence

      blocks.push(
        <CodeBlock key={key++} language={language} code={code.join("\n")} />
      );

      continue;
    }

    /* ---- table ---- */
    if (
      line.trim().startsWith("|") &&
      index + 1 < lines.length &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1])
    ) {
      const rows = [];

      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(lines[index].trim());
        index++;
      }

      blocks.push(renderTable(rows, `t${key++}`));
      continue;
    }

    /* ---- heading ---- */
    const heading = line.match(/^(#{1,4})\s+(.*)$/);

    if (heading) {
      const Tag = `h${Math.min(heading[1].length + 2, 6)}`;

      blocks.push(
        <Tag className="mdHeading" key={key}>
          {renderInline(heading[2], `h${key++}`)}
        </Tag>
      );

      index++;
      continue;
    }

    /* ---- horizontal rule ---- */
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr className="mdRule" key={key++} />);
      index++;
      continue;
    }

    /* ---- blockquote ---- */
    if (/^\s*>\s?/.test(line)) {
      const quote = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index++;
      }

      blocks.push(
        <blockquote className="mdQuote" key={key}>
          {renderInline(quote.join(" "), `q${key++}`)}
        </blockquote>
      );

      continue;
    }

    /* ---- lists ---- */
    const isBullet = /^\s*[-*+]\s+/.test(line);
    const isNumber = /^\s*\d+[.)]\s+/.test(line);

    if (isBullet || isNumber) {
      const items = [];
      const matcher = isBullet ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;

      while (index < lines.length && matcher.test(lines[index])) {
        items.push(lines[index].replace(matcher, ""));
        index++;
      }

      const Tag = isBullet ? "ul" : "ol";

      blocks.push(
        <Tag className="mdList" key={key}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `l${key}-${itemIndex}`)}</li>
          ))}
        </Tag>
      );

      key++;
      continue;
    }

    /* ---- paragraph ---- */
    if (!line.trim()) {
      index++;
      continue;
    }

    const paragraph = [];

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index++;
    }

    blocks.push(
      <p className="mdParagraph" key={key}>
        {renderInline(paragraph.join("\n"), `p${key++}`)}
      </p>
    );
  }

  return <div className="markdown">{blocks}</div>;
}
