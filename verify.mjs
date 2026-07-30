/**
 * SG CRM 통합 검증 스크립트
 *
 *   node verify.mjs            (index.html 검사)
 *   node verify.mjs 다른파일.html
 *
 * 검사 항목
 *  1. 문법 오류 (node --check)
 *  2. 중괄호 균형 / 중복 함수 / 함수 개수
 *  3. Firebase 참조 · window export 존재
 *  4. 인라인 핸들러(onclick 등)가 호출하는 함수가 window에 export 됐는지
 *     → 이게 빠지면 문법은 통과하지만 버튼이 눌리지 않음 (이 코드베이스의 대표적 사고 유형)
 *
 * 실패 시 exit code 1
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2] || 'index.html';
const content = readFileSync(file, 'utf8');

const START = '<script type="module">';
const si = content.indexOf(START);
if (si === -1) {
  console.error('❌ <script type="module"> 블록을 찾지 못했습니다.');
  process.exit(1);
}
const js = content.slice(si + START.length, content.lastIndexOf('</script>'));

let failed = false;
const fail = (msg) => { failed = true; console.log('❌ ' + msg); };
const pass = (msg) => console.log('✅ ' + msg);

// ── 1. 문법 검사 ──
const tmp = join(tmpdir(), 'sgcrm_verify_tmp.mjs');
writeFileSync(tmp, js);
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  pass('문법 오류 없음 (node --check)');
} catch (e) {
  fail('문법 오류:\n' + (e.stderr || e.stdout || '').toString().trim());
} finally {
  rmSync(tmp, { force: true });
}

// ── 2. 중괄호 균형 / 함수 ──
const jsNoImport = js.replace(/import\s+.*?from\s+['"]\S+['"];?\n?/g, '');
let braces = 0;
for (const ch of jsNoImport) {
  if (ch === '{') braces++;
  else if (ch === '}') braces--;
}
if (braces === 0) pass('중괄호 균형 0');
else fail(`중괄호 균형 ${braces} (0이어야 함)`);

const fns = [...js.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].map(m => m[1]);
const counts = {};
for (const f of fns) counts[f] = (counts[f] || 0) + 1;
const dups = Object.entries(counts).filter(([, v]) => v > 1);
if (dups.length) fail('중복 함수: ' + JSON.stringify(dups));
else pass(`중복 함수 없음 (총 ${fns.length}개)`);

// ── 3. 필수 참조 ──
content.includes('sg-crm-f9adc')
  ? pass('Firebase(sg-crm-f9adc) 참조 있음')
  : fail('Firebase 프로젝트 참조가 사라졌습니다');

const oaIdx = js.indexOf('Object.assign(window,{');
if (oaIdx === -1) {
  fail('Object.assign(window,{...}) 전역 export 블록이 없습니다');
}

// ── 4. 인라인 핸들러 ↔ window export 대조 ──
if (oaIdx !== -1) {
  // export 블록 추출 (괄호 균형으로 끝 찾기)
  let depth = 0, end = -1;
  for (let i = oaIdx + 'Object.assign(window,'.length; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = end > -1 ? js.slice(oaIdx, end) : '';
  const exported = new Set(
    [...block.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*(?=[,}\n])/g)].map(m => m[1])
  );
  // 함수 선언 외에 window.X = 형태도 인정
  for (const m of js.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) exported.add(m[1]);

  const BUILTIN = new Set([
    'alert', 'confirm', 'prompt', 'Number', 'String', 'Boolean', 'Array', 'Object',
    'Date', 'Math', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout',
    'setInterval', 'encodeURIComponent', 'decodeURIComponent', 'RegExp', 'Set', 'Map',
    'if', 'for', 'while', 'switch', 'return', 'typeof', 'function', 'catch',
  ]);

  // HTML 영역(스크립트 제외)의 인라인 핸들러만 검사
  const html = content.slice(0, si) + content.slice(content.lastIndexOf('</script>'));
  const missing = new Map();
  for (const h of html.matchAll(/\bon[a-z]+\s*=\s*"([^"]*)"/g)) {
    // 핸들러 안의 문자열 리터럴 제거 — this.style.background='rgba(...)' 같은 CSS 오탐 방지
    const code = h[1].replace(/'[^']*'/g, "''");
    for (const c of code.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = c[1];
      if (BUILTIN.has(name) || exported.has(name)) continue;
      missing.set(name, (missing.get(name) || 0) + 1);
    }
  }
  if (missing.size) {
    fail('인라인 핸들러가 부르는데 window에 export 안 된 함수: '
      + [...missing.entries()].map(([n, c]) => `${n}(${c}회)`).join(', '));
  } else {
    pass(`인라인 핸들러 함수 전부 export 됨 (export ${exported.size}개)`);
  }
}

console.log(failed ? '\n검증 실패 — 커밋하지 마세요.' : '\n검증 통과.');
process.exit(failed ? 1 : 0);
