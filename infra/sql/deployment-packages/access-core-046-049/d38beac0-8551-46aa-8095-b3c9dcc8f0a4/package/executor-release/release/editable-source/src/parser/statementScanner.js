'use strict';

const { sha256Bytes } = require('../hash/canonical');

class SqlLexicalError extends Error {
  constructor(code, offset, detail = '') {
    super(`${code} at byte ${offset}${detail ? `: ${detail}` : ''}`);
    this.name = 'SqlLexicalError';
    this.code = code;
    this.offset = offset;
  }
}

const isSpace = (b) => b === 9 || b === 10 || b === 11 || b === 12 || b === 13 || b === 32;
const isIdentStart = (b) => (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 95 || b >= 128;
const isIdentPart = (b) => isIdentStart(b) || (b >= 48 && b <= 57) || b === 36;

function dollarTagAt(input, offset) {
  if (input[offset] !== 36) return null;
  if (input[offset + 1] === 36) return input.subarray(offset, offset + 2);
  if (!isIdentStart(input[offset + 1])) return null;
  let i = offset + 2;
  while (i < input.length && isIdentPart(input[i]) && input[i] !== 36) i += 1;
  if (i < input.length && input[i] === 36) return input.subarray(offset, i + 1);
  return null;
}

function escapeStringPrefix(input, quoteOffset) {
  if (quoteOffset === 0 || (input[quoteOffset - 1] !== 69 && input[quoteOffset - 1] !== 101)) return false;
  return quoteOffset < 2 || !isIdentPart(input[quoteOffset - 2]);
}

function scanBoundaries(input) {
  if (!Buffer.isBuffer(input)) throw new TypeError('scanner input must be a Buffer');
  const boundaries = [];
  let state = 'normal';
  let stateStart = 0;
  let blockDepth = 0;
  let tag = null;
  let escapeString = false;
  for (let i = 0; i < input.length; i += 1) {
    const b = input[i];
    const n = input[i + 1];
    if (state === 'normal') {
      if (b === 39) {
        state = 'single'; stateStart = i; escapeString = escapeStringPrefix(input, i);
      } else if (b === 34) {
        state = 'double'; stateStart = i;
      } else if (b === 45 && n === 45) {
        state = 'line-comment'; stateStart = i; i += 1;
      } else if (b === 47 && n === 42) {
        state = 'block-comment'; stateStart = i; blockDepth = 1; i += 1;
      } else if (b === 36) {
        const candidate = dollarTagAt(input, i);
        if (candidate) {
          state = 'dollar'; stateStart = i; tag = candidate; i += tag.length - 1;
        }
      } else if (b === 59) {
        boundaries.push(i + 1);
      }
    } else if (state === 'single') {
      if (escapeString && b === 92) {
        if (i + 1 >= input.length) throw new SqlLexicalError('UNTERMINATED_ESCAPED_STRING', stateStart);
        i += 1;
      } else if (b === 39 && n === 39) {
        i += 1;
      } else if (b === 39) {
        state = 'normal';
      }
    } else if (state === 'double') {
      if (b === 34 && n === 34) i += 1;
      else if (b === 34) state = 'normal';
    } else if (state === 'line-comment') {
      if (b === 10 || b === 13) state = 'normal';
    } else if (state === 'block-comment') {
      if (b === 47 && n === 42) { blockDepth += 1; i += 1; }
      else if (b === 42 && n === 47) {
        blockDepth -= 1; i += 1;
        if (blockDepth === 0) state = 'normal';
      }
    } else if (state === 'dollar') {
      if (b === 36 && i + tag.length <= input.length && input.subarray(i, i + tag.length).equals(tag)) {
        i += tag.length - 1; state = 'normal'; tag = null;
      }
    }
  }
  if (state === 'line-comment') state = 'normal';
  if (state !== 'normal') {
    const code = {
      single: 'UNTERMINATED_SINGLE_QUOTE',
      double: 'UNTERMINATED_DOUBLE_QUOTE',
      'block-comment': 'UNTERMINATED_BLOCK_COMMENT',
      dollar: 'UNTERMINATED_DOLLAR_QUOTE',
    }[state];
    throw new SqlLexicalError(code, stateStart, state === 'dollar' ? tag.toString('utf8') : '');
  }
  return boundaries;
}

function triviaLength(segment) {
  let i = 0;
  while (i < segment.length) {
    if (isSpace(segment[i])) { i += 1; continue; }
    if (segment[i] === 45 && segment[i + 1] === 45) {
      i += 2; while (i < segment.length && segment[i] !== 10 && segment[i] !== 13) i += 1; continue;
    }
    if (segment[i] === 47 && segment[i + 1] === 42) {
      let depth = 1; i += 2;
      while (i < segment.length && depth) {
        if (segment[i] === 47 && segment[i + 1] === 42) { depth += 1; i += 2; }
        else if (segment[i] === 42 && segment[i + 1] === 47) { depth -= 1; i += 2; }
        else i += 1;
      }
      continue;
    }
    break;
  }
  return i;
}

function significantSql(statement) {
  let text = statement.toString('utf8');
  for (;;) {
    const prior = text;
    text = text.replace(/^\s+/, '').replace(/^--[^\r\n]*(?:\r?\n|$)/, '').replace(/^\/\*[\s\S]*?\*\//, '');
    if (text === prior) break;
  }
  return text.replace(/;\s*$/, '').trim();
}

function transactionControlKind(statement) {
  const sql = significantSql(statement);
  const words = sql.match(/^[A-Za-z]+(?:\s+[A-Za-z]+){0,3}/);
  if (!words) return null;
  const normalized = words[0].replace(/\s+/g, ' ').toUpperCase();
  const first = normalized.split(' ')[0];
  if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'ABORT', 'SAVEPOINT'].includes(first)) return first;
  if (normalized.startsWith('START TRANSACTION')) return 'START TRANSACTION';
  if (normalized.startsWith('RELEASE SAVEPOINT') || first === 'RELEASE') return 'RELEASE SAVEPOINT';
  if (normalized.startsWith('PREPARE TRANSACTION')) return 'PREPARE TRANSACTION';
  if (normalized.startsWith('SET TRANSACTION')) return 'SET TRANSACTION';
  if (normalized.startsWith('SET SESSION CHARACTERISTICS')) return 'SET SESSION CHARACTERISTICS AS TRANSACTION';
  return null;
}

function scanStatements(input) {
  const boundaries = scanBoundaries(input);
  const parts = [];
  let offset = 0;
  for (const end of boundaries) {
    const segment = input.subarray(offset, end);
    const trivia = triviaLength(segment);
    const separator = segment.subarray(0, trivia);
    const statement = segment.subarray(trivia);
    if (significantSql(statement)) {
      parts.push({
        separator,
        statement,
        start: offset + trivia,
        end,
        sha256: sha256Bytes(statement),
        size: statement.length,
        transactionControl: transactionControlKind(statement),
      });
    } else if (segment.length) {
      parts.push({ separator: segment, statement: Buffer.alloc(0), start: end, end, sha256: null, size: 0, transactionControl: null });
    }
    offset = end;
  }
  const tail = input.subarray(offset);
  if (significantSql(tail)) throw new SqlLexicalError('UNTERMINATED_STATEMENT_WITHOUT_SEMICOLON', offset + triviaLength(tail));
  const trailingSeparator = Buffer.concat([...(parts.length && parts[parts.length - 1].statement.length === 0 ? [parts.pop().separator] : []), tail]);
  const reconstructed = Buffer.concat(parts.flatMap((part) => [part.separator, part.statement]).concat([trailingSeparator]));
  if (!reconstructed.equals(input)) throw new Error('SCANNER_RECONSTRUCTION_FAILURE');
  return {
    parts,
    statements: parts.filter((part) => part.statement.length),
    trailingSeparator,
    reconstructed,
    transactionControls: parts.filter((part) => part.transactionControl),
  };
}

module.exports = { SqlLexicalError, scanBoundaries, scanStatements, transactionControlKind, significantSql };
