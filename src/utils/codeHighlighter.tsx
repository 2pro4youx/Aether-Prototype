import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLanguageTheme } from './languageThemes';

// ============================================================================
// Official VS Code Theme Palettes (Dark+ and Light+)
// ============================================================================
export const VS_CODE_DARK_COLORS = {
  keywordControl: '#c586c0', // Magenta/Purple: if, else, for, return, import, from, try
  keywordDecl: '#569cd6',    // Blue: def, class, function, const, let, var, type
  function: '#dcdcaa',       // Yellow: function/method calls
  type: '#4ec9b0',           // Teal: Classes, Types, Interfaces
  string: '#ce9178',         // Coral/Peach: '...', "..."
  number: '#b5cea8',         // Mint Green: 123, 0.5
  boolean: '#569cd6',        // Blue: True, False, true, false, None, null
  comment: '#6a9955',        // Olive Green: # ..., // ...
  operator: '#d4d4d4',       // Light Gray: +, -, *, =, ->
  punctuation: '#969696',    // Gray: (, ), {, }, [, ]
  variable: '#9cdcfe',       // Sky Blue: parameters, local vars
  property: '#9cdcfe',       // Sky Blue: obj.prop, JSON keys
  decorator: '#dcdcaa',      // Yellow: @decorator
  tag: '#569cd6',            // Blue: <div>
  attribute: '#9cdcfe',      // Sky Blue: className=
  plain: '#d4d4d4',          // Standard code text
};

export const VS_CODE_LIGHT_COLORS = {
  keywordControl: '#af00db', // Purple
  keywordDecl: '#0000ff',    // Blue
  function: '#795e26',       // Warm Brown/Gold
  type: '#267f99',           // Dark Teal
  string: '#a31515',         // Crimson Red
  number: '#098658',         // Emerald Green
  boolean: '#0000ff',        // Blue
  comment: '#008000',        // Forest Green
  operator: '#000000',       // Black/Charcoal
  punctuation: '#6e7781',    // Slate Gray
  variable: '#001080',       // Navy
  property: '#001080',       // Navy
  decorator: '#795e26',      // Gold
  tag: '#800000',            // Maroon
  attribute: '#e50000',      // Red
  plain: '#1f2328',          // Dark Charcoal
};

export type TokenType =
  | 'keywordControl'
  | 'keywordDecl'
  | 'function'
  | 'type'
  | 'string'
  | 'number'
  | 'boolean'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'variable'
  | 'property'
  | 'decorator'
  | 'tag'
  | 'attribute'
  | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

// ============================================================================
// Keywords and Built-ins Sets per Language Family
// ============================================================================
const PYTHON_CONTROL = new Set([
  'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return',
  'yield', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise',
  'with', 'async', 'await', 'pass', 'match', 'case', 'in', 'is', 'not',
  'and', 'or', 'assert', 'del'
]);
const PYTHON_DECL = new Set(['def', 'class', 'lambda', 'global', 'nonlocal']);
const PYTHON_CONST = new Set(['True', 'False', 'None']);
const PYTHON_BUILTIN = new Set([
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sum',
  'min', 'max', 'open', 'super', 'isinstance', 'type', 'list', 'dict',
  'set', 'tuple', 'int', 'float', 'str', 'bool', 'bytes', 'self', 'cls'
]);

const JS_CONTROL = new Set([
  'if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do',
  'break', 'continue', 'return', 'yield', 'throw', 'try', 'catch',
  'finally', 'import', 'export', 'from', 'as', 'await'
]);
const JS_DECL = new Set([
  'function', 'const', 'let', 'var', 'class', 'interface', 'type',
  'enum', 'extends', 'implements', 'new', 'delete', 'typeof',
  'instanceof', 'void', 'this', 'super', 'static', 'async', 'public',
  'private', 'protected', 'readonly', 'abstract', 'declare', 'namespace'
]);
const JS_CONST = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const JS_BUILTIN = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'void',
  'object', 'symbol', 'bigint', 'Promise', 'Array', 'Record', 'Partial',
  'console', 'window', 'document', 'React', 'useState', 'useEffect',
  'useMemo', 'useCallback', 'useRef', 'Math', 'JSON', 'Date'
]);

const RUST_CONTROL = new Set([
  'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'return',
  'break', 'continue', 'yield', 'await'
]);
const RUST_DECL = new Set([
  'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait',
  'impl', 'type', 'pub', 'mod', 'use', 'as', 'move', 'ref', 'unsafe',
  'where', 'async', 'dyn', 'crate', 'super', 'self', 'Self'
]);
const RUST_CONST = new Set(['true', 'false', 'Some', 'None', 'Ok', 'Err']);
const RUST_TYPES = new Set([
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32',
  'u64', 'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str',
  'String', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc'
]);

const CPP_CONTROL = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'goto', 'try', 'catch', 'throw'
]);
const CPP_DECL = new Set([
  'sizeof', 'typedef', 'struct', 'class', 'enum', 'union', 'template',
  'typename', 'namespace', 'using', 'public', 'private', 'protected',
  'virtual', 'override', 'final', 'inline', 'static', 'const', 'constexpr',
  'volatile', 'auto', 'explicit', 'friend', 'new', 'delete', '__global__',
  '__device__', '__host__', '__shared__', '__constant__'
]);
const CPP_CONST = new Set(['true', 'false', 'NULL', 'nullptr']);
const CPP_TYPES = new Set([
  'void', 'int', 'short', 'long', 'float', 'double', 'char', 'bool',
  'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t',
  'int16_t', 'int32_t', 'int64_t', 'std', 'vector', 'string', 'map',
  'unique_ptr', 'shared_ptr'
]);

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
  'CREATE', 'TABLE', 'DROP', 'ALTER', 'VIEW', 'INDEX', 'PRIMARY',
  'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'DEFAULT', 'AND',
  'OR', 'IN', 'BETWEEN', 'LIKE', 'IS', 'EXISTS', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
  'MIN', 'MAX', 'SET', 'VALUES'
]);

// ============================================================================
// High-Speed Syntax Tokenizer for VS Code Syntax Colors
// ============================================================================
export function tokenizeCode(code: string, language: string = 'python'): Token[] {
  if (!code) return [];
  const lang = language.toLowerCase();
  const tokens: Token[] = [];
  const len = code.length;
  let pos = 0;

  const isAlpha = (c: string) => /[a-zA-Z_$]/.test(c);
  const isAlphaNum = (c: string) => /[a-zA-Z0-9_$]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);

  while (pos < len) {
    const ch = code[pos];
    const next = pos + 1 < len ? code[pos + 1] : '';

    // 1. Whitespace
    if (/\s/.test(ch)) {
      let end = pos + 1;
      while (end < len && /\s/.test(code[end])) end++;
      tokens.push({ type: 'plain', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // 2. Comments
    // Python / Bash / Shell line comment (#)
    if ((lang === 'python' || lang === 'bash' || lang === 'sh' || lang === 'shell') && ch === '#') {
      let end = pos;
      while (end < len && code[end] !== '\n') end++;
      tokens.push({ type: 'comment', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // SQL line comment (--)
    if (lang === 'sql' && ch === '-' && next === '-') {
      let end = pos;
      while (end < len && code[end] !== '\n') end++;
      tokens.push({ type: 'comment', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // C-style line comment (//)
    if (ch === '/' && next === '/') {
      let end = pos;
      while (end < len && code[end] !== '\n') end++;
      tokens.push({ type: 'comment', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // C-style block comment (/* ... */)
    if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', pos + 2);
      if (end !== -1) {
        tokens.push({ type: 'comment', text: code.slice(pos, end + 2) });
        pos = end + 2;
      } else {
        tokens.push({ type: 'comment', text: code.slice(pos) });
        pos = len;
      }
      continue;
    }

    // HTML / XML comment (<!-- ... -->)
    if (ch === '<' && code.slice(pos, pos + 4) === '<!--') {
      const end = code.indexOf('-->', pos + 4);
      if (end !== -1) {
        tokens.push({ type: 'comment', text: code.slice(pos, end + 3) });
        pos = end + 3;
      } else {
        tokens.push({ type: 'comment', text: code.slice(pos) });
        pos = len;
      }
      continue;
    }

    // 3. Strings
    // Python triple quote strings (docstrings)
    if (lang === 'python' && (code.slice(pos, pos + 3) === '"""' || code.slice(pos, pos + 3) === "'''")) {
      const delim = code.slice(pos, pos + 3);
      const end = code.indexOf(delim, pos + 3);
      if (end !== -1) {
        tokens.push({ type: 'string', text: code.slice(pos, end + 3) });
        pos = end + 3;
      } else {
        tokens.push({ type: 'string', text: code.slice(pos) });
        pos = len;
      }
      continue;
    }

    // Template string (`...`)
    if (ch === '`') {
      let end = pos + 1;
      while (end < len) {
        if (code[end] === '\\') {
          end += 2;
        } else if (code[end] === '`') {
          end++;
          break;
        } else {
          end++;
        }
      }
      tokens.push({ type: 'string', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // Single / Double quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = pos + 1;
      while (end < len) {
        if (code[end] === '\\') {
          end += 2;
        } else if (code[end] === quote) {
          end++;
          break;
        } else if (code[end] === '\n') {
          break; // Unterminated string on newline
        } else {
          end++;
        }
      }
      tokens.push({ type: 'string', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // 4. Decorators / Macros (@decorator or #include)
    if (ch === '@' && isAlpha(next)) {
      let end = pos + 1;
      while (end < len && (isAlphaNum(code[end]) || code[end] === '.')) end++;
      tokens.push({ type: 'decorator', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    if ((lang === 'cpp' || lang === 'c' || lang === 'cuda') && ch === '#' && isAlpha(next)) {
      let end = pos + 1;
      while (end < len && isAlphaNum(code[end])) end++;
      tokens.push({ type: 'keywordDecl', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // 5. Numbers
    if (isDigit(ch) || (ch === '.' && isDigit(next))) {
      let end = pos;
      if (ch === '0' && (code[pos + 1] === 'x' || code[pos + 1] === 'X')) {
        end += 2;
        while (end < len && /[0-9a-fA-F_]/.test(code[end])) end++;
      } else if (ch === '0' && (code[pos + 1] === 'b' || code[pos + 1] === 'B')) {
        end += 2;
        while (end < len && /[01_]/.test(code[end])) end++;
      } else {
        while (end < len && /[0-9_]/.test(code[end])) end++;
        if (end < len && code[end] === '.' && isDigit(code[end + 1])) {
          end++;
          while (end < len && /[0-9_]/.test(code[end])) end++;
        }
        if (end < len && (code[end] === 'e' || code[end] === 'E')) {
          end++;
          if (end < len && (code[end] === '+' || code[end] === '-')) end++;
          while (end < len && /[0-9_]/.test(code[end])) end++;
        }
      }
      tokens.push({ type: 'number', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // 6. Identifiers, Keywords, Functions, Types
    if (isAlpha(ch)) {
      let end = pos;
      while (end < len && isAlphaNum(code[end])) end++;
      const word = code.slice(pos, end);

      // Check if followed by open parenthesis '(' (function call)
      let lookahead = end;
      while (lookahead < len && code[lookahead] === ' ') lookahead++;
      const isCall = lookahead < len && code[lookahead] === '(';

      // Check if followed by colon ':' in JSON / Object literal
      const isObjectKey = lookahead < len && code[lookahead] === ':' && code[lookahead + 1] !== ':';

      let type: TokenType = 'plain';

      if (lang === 'sql') {
        const upper = word.toUpperCase();
        if (SQL_KEYWORDS.has(upper)) {
          type = 'keywordControl';
        } else if (isCall) {
          type = 'function';
        }
      } else if (lang === 'python') {
        if (PYTHON_CONTROL.has(word)) type = 'keywordControl';
        else if (PYTHON_DECL.has(word)) type = 'keywordDecl';
        else if (PYTHON_CONST.has(word)) type = 'boolean';
        else if (PYTHON_BUILTIN.has(word)) type = 'type';
        else if (isCall) type = 'function';
        else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) type = 'type';
        else type = 'variable';
      } else if (lang === 'rust') {
        if (RUST_CONTROL.has(word)) type = 'keywordControl';
        else if (RUST_DECL.has(word)) type = 'keywordDecl';
        else if (RUST_CONST.has(word)) type = 'boolean';
        else if (RUST_TYPES.has(word)) type = 'type';
        else if (isCall) type = 'function';
        else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) type = 'type';
        else type = 'variable';
      } else if (lang === 'cpp' || lang === 'c' || lang === 'cuda') {
        if (CPP_CONTROL.has(word)) type = 'keywordControl';
        else if (CPP_DECL.has(word)) type = 'keywordDecl';
        else if (CPP_CONST.has(word)) type = 'boolean';
        else if (CPP_TYPES.has(word)) type = 'type';
        else if (isCall) type = 'function';
        else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) type = 'type';
        else type = 'variable';
      } else {
        // JavaScript / TypeScript / Default
        if (JS_CONTROL.has(word)) type = 'keywordControl';
        else if (JS_DECL.has(word)) type = 'keywordDecl';
        else if (JS_CONST.has(word)) type = 'boolean';
        else if (JS_BUILTIN.has(word)) type = 'type';
        else if (isCall) type = 'function';
        else if (isObjectKey) type = 'property';
        else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) type = 'type';
        else type = 'variable';
      }

      tokens.push({ type, text: word });
      pos = end;
      continue;
    }

    // 7. Operators & Punctuation
    if (/[{}()[\].,;:?]/.test(ch)) {
      tokens.push({ type: 'punctuation', text: ch });
      pos++;
      continue;
    }

    if (/[=+\-*/%&|^!<>~]/.test(ch)) {
      let end = pos;
      while (end < len && /[=+\-*/%&|^!<>~]/.test(code[end])) end++;
      tokens.push({ type: 'operator', text: code.slice(pos, end) });
      pos = end;
      continue;
    }

    // Default fallback single char
    tokens.push({ type: 'plain', text: ch });
    pos++;
  }

  return tokens;
}

// ============================================================================
// Natural Coding Indent on Tab, Shift+Tab, and Smart Enter
// ============================================================================
export function handleCodeIndentKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (newValue: string) => void,
  language: string = 'python'
): boolean {
  const textarea = e.currentTarget;
  const { selectionStart, selectionEnd } = textarea;
  const isPython = language.toLowerCase() === 'python';
  const indentSize = isPython ? 4 : 2;
  const indent = ' '.repeat(indentSize);

  // 1. TAB or SHIFT+TAB (Natural Indentation)
  if (e.key === 'Tab') {
    e.preventDefault();

    // Multi-line selection indent/outdent
    if (selectionStart !== selectionEnd) {
      const firstLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lastLineEndIndex = value.indexOf('\n', selectionEnd);
      const lastLineEnd = lastLineEndIndex === -1 ? value.length : lastLineEndIndex;

      const selectedBlock = value.substring(firstLineStart, lastLineEnd);
      const lines = selectedBlock.split('\n');

      if (e.shiftKey) {
        // Shift+Tab: Outdent lines
        let removedFirstLine = 0;
        let totalRemoved = 0;
        const outdentedLines = lines.map((line, idx) => {
          let match = line.match(/^ {1,4}/);
          if (!match && line.startsWith('\t')) {
            match = ['\t'];
          }
          if (match) {
            const count = match[0].length;
            totalRemoved += count;
            if (idx === 0) removedFirstLine = count;
            return line.substring(count);
          }
          return line;
        });

        const newBlock = outdentedLines.join('\n');
        const newValue =
          value.substring(0, firstLineStart) + newBlock + value.substring(lastLineEnd);
        onChange(newValue);

        requestAnimationFrame(() => {
          textarea.setSelectionRange(
            Math.max(firstLineStart, selectionStart - removedFirstLine),
            Math.max(firstLineStart, selectionEnd - totalRemoved)
          );
        });
      } else {
        // Tab: Indent lines
        const indentedLines = lines.map((line) => indent + line);
        const newBlock = indentedLines.join('\n');
        const addedTotal = indent.length * lines.length;
        const newValue =
          value.substring(0, firstLineStart) + newBlock + value.substring(lastLineEnd);
        onChange(newValue);

        requestAnimationFrame(() => {
          textarea.setSelectionRange(
            selectionStart + indent.length,
            selectionEnd + addedTotal
          );
        });
      }
    } else {
      // Single cursor
      if (e.shiftKey) {
        // Shift+Tab: Outdent current line
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const line = value.substring(lineStart, selectionEnd);
        const match = line.match(/^ {1,4}/);
        if (match) {
          const count = match[0].length;
          const newValue =
            value.substring(0, lineStart) + value.substring(lineStart + count);
          onChange(newValue);
          requestAnimationFrame(() => {
            const newPos = Math.max(lineStart, selectionStart - count);
            textarea.setSelectionRange(newPos, newPos);
          });
        }
      } else {
        // Tab: Insert natural spaces at cursor
        const newValue =
          value.substring(0, selectionStart) + indent + value.substring(selectionEnd);
        onChange(newValue);
        requestAnimationFrame(() => {
          const newPos = selectionStart + indent.length;
          textarea.setSelectionRange(newPos, newPos);
        });
      }
    }
    return true;
  }

  // 2. ENTER: Smart Auto-Indent (copies leading spaces, adds indent after ':' or '{')
  if (e.key === 'Enter') {
    e.preventDefault();
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const currentLine = value.substring(lineStart, selectionStart);
    const indentMatch = currentLine.match(/^[ \t]*/);
    let currentIndent = indentMatch ? indentMatch[0] : '';

    const trimmed = currentLine.trimEnd();
    const shouldAddExtraIndent =
      trimmed.endsWith(':') ||
      trimmed.endsWith('{') ||
      trimmed.endsWith('[') ||
      trimmed.endsWith('(');

    if (shouldAddExtraIndent) {
      currentIndent += indent;
    }

    const insertion = '\n' + currentIndent;
    const newValue =
      value.substring(0, selectionStart) + insertion + value.substring(selectionEnd);
    onChange(newValue);

    requestAnimationFrame(() => {
      const newPos = selectionStart + insertion.length;
      textarea.setSelectionRange(newPos, newPos);
    });
    return true;
  }

  // 3. BACKSPACE: Smart un-indent if cursor is surrounded only by indent spaces
  if (e.key === 'Backspace' && selectionStart === selectionEnd && selectionStart > 0) {
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const textBefore = value.substring(lineStart, selectionStart);
    if (textBefore.length > 0 && /^ +$/.test(textBefore)) {
      const spacesToDelete =
        textBefore.length % indentSize === 0 ? indentSize : textBefore.length % indentSize;
      e.preventDefault();
      const newValue =
        value.substring(0, selectionStart - spacesToDelete) + value.substring(selectionStart);
      onChange(newValue);
      requestAnimationFrame(() => {
        const newPos = selectionStart - spacesToDelete;
        textarea.setSelectionRange(newPos, newPos);
      });
      return true;
    }
  }

  return false;
}

// ============================================================================
// Render Highlighted Code Tokens with VS Code Themes
// ============================================================================
export function renderHighlightedTokens(
  code: string,
  language: string,
  darkMode: boolean
): React.ReactNode {
  const tokens = tokenizeCode(code, language);
  const palette = darkMode ? VS_CODE_DARK_COLORS : VS_CODE_LIGHT_COLORS;

  return tokens.map((token, index) => {
    let color = palette.plain;
    let isItalic = false;

    switch (token.type) {
      case 'keywordControl':
        color = palette.keywordControl;
        break;
      case 'keywordDecl':
        color = palette.keywordDecl;
        break;
      case 'function':
        color = palette.function;
        break;
      case 'type':
        color = palette.type;
        break;
      case 'string':
        color = palette.string;
        break;
      case 'number':
        color = palette.number;
        break;
      case 'boolean':
        color = palette.boolean;
        break;
      case 'comment':
        color = palette.comment;
        isItalic = true;
        break;
      case 'operator':
        color = palette.operator;
        break;
      case 'punctuation':
        color = palette.punctuation;
        break;
      case 'variable':
        color = palette.variable;
        break;
      case 'property':
        color = palette.property;
        break;
      case 'decorator':
        color = palette.decorator;
        break;
      case 'tag':
        color = palette.tag;
        break;
      case 'attribute':
        color = palette.attribute;
        break;
      default:
        color = palette.plain;
    }

    return (
      <span
        key={index}
        style={{
          color,
          fontStyle: isItalic ? 'italic' : 'normal',
        }}
      >
        {token.text}
      </span>
    );
  });
}

// ============================================================================
// Render Highlighted Code to HTML string (for MarkdownRenderer & Static blocks)
// ============================================================================
export function renderHighlightedCodeToHtml(
  code: string,
  language: string,
  darkMode: boolean
): string {
  const tokens = tokenizeCode(code, language);
  const palette = darkMode ? VS_CODE_DARK_COLORS : VS_CODE_LIGHT_COLORS;

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return tokens
    .map((token) => {
      let color = palette.plain;
      let isItalic = false;

      switch (token.type) {
        case 'keywordControl':
          color = palette.keywordControl;
          break;
        case 'keywordDecl':
          color = palette.keywordDecl;
          break;
        case 'function':
          color = palette.function;
          break;
        case 'type':
          color = palette.type;
          break;
        case 'string':
          color = palette.string;
          break;
        case 'number':
          color = palette.number;
          break;
        case 'boolean':
          color = palette.boolean;
          break;
        case 'comment':
          color = palette.comment;
          isItalic = true;
          break;
        case 'operator':
          color = palette.operator;
          break;
        case 'punctuation':
          color = palette.punctuation;
          break;
        case 'variable':
          color = palette.variable;
          break;
        case 'property':
          color = palette.property;
          break;
        case 'decorator':
          color = palette.decorator;
          break;
        case 'tag':
          color = palette.tag;
          break;
        case 'attribute':
          color = palette.attribute;
          break;
        default:
          color = palette.plain;
      }

      const style = `color:${color};${isItalic ? 'font-style:italic;' : ''}`;
      return `<span style="${style}">${escapeHtml(token.text)}</span>`;
    })
    .join('');
}

// ============================================================================
// Full Interactive Code Block Component with OneNote Theme & VS Code Styling
// ============================================================================
export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange?: (language: string) => void;
  darkMode: boolean;
  themeColor?: string;
  headerActions?: React.ReactNode;
  placeholder?: string;
  minHeight?: number;
  isCompanion?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  darkMode,
  themeColor,
  headerActions,
  placeholder,
  minHeight = 160,
  isCompanion = false,
}) => {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const langTheme = getLanguageTheme(language);
  const lineCount = Math.max(1, (value || '').split('\n').length);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount]
  );

  // Synchronize scroll between textarea, pre highlighter, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Pre-rendered highlighted code tokens
  const highlightedTokens = useMemo(
    () => renderHighlightedTokens(value, language, darkMode),
    [value, language, darkMode]
  );

  return (
    <div
      className={`overflow-hidden transition-all duration-200 flex flex-col ${
        isCompanion
          ? 'w-full h-full'
          : `rounded-xl border ${
              darkMode
                ? 'bg-[#141722] border-slate-700/80 shadow-lg shadow-black/40'
                : 'bg-white border-slate-300 shadow-md shadow-slate-200/60'
            }`
      }`}
    >
      {/* Code Block Header (OneNote Palette with Language Indicator) */}
      <div
        className={`px-3 py-2 border-b flex items-center justify-between text-xs font-mono select-none transition-colors ${
          darkMode
            ? 'bg-[#181d2a] border-white/5 text-slate-300'
            : 'bg-slate-100/90 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Language Dot Indicator */}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
            style={{
              backgroundColor: langTheme.dotColor,
              boxShadow: `0 0 6px ${langTheme.dotColor}`,
            }}
            title={`${langTheme.name} syntax`}
          />
          <Code2 className="w-3.5 h-3.5 shrink-0" style={{ color: langTheme.dotColor }} />

          {/* Language Selector */}
          {onLanguageChange ? (
            <select
              value={language || 'python'}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{ color: langTheme.dotColor }}
              className="bg-transparent uppercase font-bold text-xs focus:outline-none cursor-pointer tracking-wider font-mono hover:opacity-80 transition-opacity"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                  className={darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}
                >
                  {l.name.toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="uppercase font-bold text-xs tracking-wider"
              style={{ color: langTheme.dotColor }}
            >
              {langTheme.name}
            </span>
          )}

          {/* Line Count Badge */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              darkMode ? 'bg-white/5 text-slate-400' : 'bg-black/5 text-slate-500'
            }`}
          >
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        {/* Right Header Actions: Copy Button + Custom Actions (e.g. + Side Image / Swap) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-2 py-0.5 rounded text-[10px] font-sans transition-all flex items-center gap-1 active:scale-95 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : darkMode
                ? 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                : 'bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-900'
            }`}
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 opacity-70" />
                <span>Copy</span>
              </>
            )}
          </button>

          {headerActions}
        </div>
      </div>

      {/* Editor Body: Line Number Gutter + Synchronized Syntax Highlighter & Textarea */}
      <div
        className="relative flex-1 flex overflow-hidden"
        style={{ minHeight: `${minHeight}px` }}
      >
        {/* Left Gutter: Non-selectable Line Numbers */}
        <div
          ref={gutterRef}
          className={`select-none py-3 px-2.5 text-right font-mono text-xs leading-relaxed overflow-hidden shrink-0 border-r ${
            darkMode
              ? 'bg-[#10121a]/80 text-slate-500/70 border-white/5'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}
          style={{ minWidth: lineCount > 99 ? '46px' : '36px' }}
          aria-hidden="true"
        >
          {lineNumbers.map((num) => (
            <div key={num} className="leading-relaxed">
              {num}
            </div>
          ))}
        </div>

        {/* Code Canvas */}
        <div className="relative flex-1 h-full min-h-[140px] overflow-hidden">
          {/* Layer 1: Background Syntax-Highlighted Code */}
          <pre
            ref={preRef}
            className="absolute inset-0 m-0 py-3 px-3.5 font-mono text-xs leading-relaxed whitespace-pre overflow-hidden pointer-events-none select-none z-0"
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              tabSize: language.toLowerCase() === 'python' ? 4 : 2,
            }}
            aria-hidden="true"
          >
            <code>{highlightedTokens}</code>
            {value.endsWith('\n') && <span className="invisible">{'\n'} </span>}
          </pre>

          {/* Layer 2: Foreground Transparent Textarea (Captures Tab, Backspace, Input) */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => handleCodeIndentKeyDown(e, value, onChange, language)}
            onScroll={handleScroll}
            placeholder={placeholder || `# Enter ${langTheme.name} implementation...`}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={`relative w-full h-full min-h-[140px] py-3 px-3.5 font-mono text-xs leading-relaxed whitespace-pre bg-transparent text-transparent focus:outline-none resize-none z-10 ${
              darkMode
                ? 'caret-cyan-400 selection:bg-cyan-500/35 selection:text-transparent placeholder:text-slate-500/40'
                : 'caret-blue-600 selection:bg-blue-500/25 selection:text-transparent placeholder:text-slate-400'
            }`}
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              tabSize: language.toLowerCase() === 'python' ? 4 : 2,
            }}
          />
        </div>
      </div>
    </div>
  );
};
