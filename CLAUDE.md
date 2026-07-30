# SG CRM v3 — Claude Code 작업 규칙

이 저장소에서 Claude Code가 따라야 할 규칙입니다. 파일 편집 시 자동 적용.

## ⚠️ 정본 파일 위치

**`<repo>/index.html` 만이 정본입니다.**

부모 폴더(`Desktop/sgcrm1/`)에 `index.html`(구버전)과 `index_2604xx_vNN.html` 백업이
다수 있으나 **모두 과거 스냅샷**입니다. 절대 그쪽을 편집하지 마세요.
편집 전 항상 경로가 `sgcrm/index.html`인지 확인할 것.

## 자동 커밋·푸시 (사용자 확인 불필요)

사용자가 명시적으로 "올리지 마"라고 하지 않는 한, 의미 있는 코드 수정 후 다음을 **자동으로** 실행:

1. **검증** — 아래 "코드 수정 후 검증" 항목을 모두 통과해야 진행
2. **git commit** — 변경 내용을 한국어 한 문장으로 요약 + `Co-Authored-By: Claude` trailer
3. **git push origin main** — 실패 시 원인 보고

검증 실패 시 **push 하지 말고** 사용자에게 원인을 알리고 롤백 여부를 확인합니다.
main 브랜치는 GitHub Pages로 자동 배포되므로, push = 즉시 배포임에 유의.

git identity (새 PC 최초 1회):
```
git config user.name "SG솔루션"
git config user.email "sgceo@sgsolutionss.com"
```

## 세션 시작 시

1. `git fetch` → `git status` 로 origin 대비 뒤처짐 확인, 뒤처졌으면 `git pull`
   (첫 파일 편집 직전에 반드시 수행 — 다른 PC가 push한 변경 반영)
2. 커밋 안 된 변경이 있으면 **먼저 사용자에게 보고**하고 지시를 기다림
3. 충돌이 있으면 편집을 중단하고 사용자에게 보고
4. `PROGRESS.md` 를 읽어 직전 작업 맥락 파악

## 코드 수정 후 검증 (필수)

수정할 때마다 아래 두 가지를 **반드시** 통과시킨 뒤 보고합니다.

```
node --check <추출한 JS>       # 문법 오류 0
node ../check.mjs index.html   # 중괄호 균형 0 / 중복 함수 없음
```

`check.mjs`는 부모 폴더(`Desktop/sgcrm1/check.mjs`)에 있습니다.
`<script type="module">` 블록을 추출해 검사하며, 기준선(현재값)은:

- 함수: 268개
- 중괄호 균형: 0
- 중복 함수: 없음
- Firebase(sg-crm-f9adc) 참조: true
- window export(Object.assign): true

`node --check`용 추출은 다음과 같이 수행합니다 (임시 폴더 사용):

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('index.html','utf8');const s='<script type=\"module\">';const i=c.indexOf(s);fs.writeFileSync(process.env.TMP+'/sgcrm_check.mjs',c.slice(i+s.length,c.lastIndexOf('</script>')))"
node --check "$TMP/sgcrm_check.mjs"
```

검증 실패 시 **커밋하지 말고** 원인을 보고하고 롤백 여부를 확인합니다.

## 응답 언어

- 항상 **한국어**로 응답
- 코드 주석 한국어 / 커밋 메시지 한국어

## 데이터 안전

- Firebase Firestore 데이터를 **직접 삭제하거나 임의 변경 금지**
- 마이그레이션 함수는 **idempotent**(중복 실행 안전) + 콘솔 로그 필수
- 대량 배치는 500 op 이하로 분할

## 코드 스타일 (기존 코드 관행 유지)

- 단일 HTML 파일, `<script type="module">` 내부에 전체 로직
- 새 전역 함수는 파일 끝 `Object.assign(window,{...})` 에 **반드시 등록**
  (등록 누락 시 `onclick="..."` 인라인 핸들러가 동작하지 않음)
- 렌더 함수는 `render*(sfx)` 패턴 — `sfx`가 `'sub'`이면 전용 페이지, `''`이면 대시보드 요약
- 스타일은 인라인 style 또는 `<head>`의 `<style>` 블록에 CSS 변수(`var(--surface)` 등) 사용

## 프로젝트 컨텍스트

- 정본: `index.html` (단일 HTML, 8,013줄)
- Firebase: `sg-crm-f9adc` (Seoul)
- 배포: GitHub Pages (main 브랜치 자동 배포)
- 원격: https://github.com/SGGIT-PNG/sgcrm
- Apps Script: 캘린더 연동용 (별도 재배포 필요, 부모 폴더 `SG_CRM_Calendar_v7_Code.gs`)
