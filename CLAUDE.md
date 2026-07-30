# SG CRM v3 — Claude Code 작업 규칙

이 저장소에서 Claude Code가 따라야 할 규칙입니다. 파일 편집 시 자동 적용.

## 자동 커밋·푸시 (사용자 확인 불필요)

사용자가 명시적으로 "올리지 마" 라고 하지 않는 한, 의미 있는 코드 수정 후 다음을 **자동으로** 실행:

1. **검증** — 아래 항목 모두 통과해야 진행
   - `node --check`로 문법 오류 없음 (module 스크립트 추출 후)
   - `check.mjs`(dashboard 폴더에 있으면) — 함수 수·중괄호 균형·중복 함수 없음
2. **git commit** — 변경 내용을 한국어로 한 문장 요약 + `Co-Authored-By: Claude` trailer
3. **git push origin main** — 실패 시 원인 보고

검증 실패 시 **push 하지 말고** 사용자에게 원인 알리고 롤백 여부 확인.

## 세션 시작 시 자동 pull

첫 파일 편집 직전에 `git pull origin main` 실행 (다른 PC/사용자가 push한 변경 반영).
충돌 있으면 편집 중단하고 사용자에게 보고.

## 응답 언어

- 항상 **한국어**로 응답
- 코드 주석은 한국어 / 커밋 메시지도 한국어

## 데이터 안전

- Firebase Firestore 데이터를 **직접 삭제하거나 임의 변경 금지**
- 마이그레이션 함수는 **idempotent**(중복 실행 안전) + 콘솔 로그 필수
- 대량 배치는 500 op 이하로 분할

## 프로젝트 컨텍스트

- 정본 파일: `index.html` (단일 HTML, 약 7,700줄)
- Firebase 프로젝트: `sg-crm-f9adc` (Seoul)
- 배포: GitHub Pages (main 브랜치 자동 배포)
- Apps Script: 캘린더 연동용 (별도 재배포 필요, `SG_CRM_Calendar_v7_Code.gs`)

## Git 커밋 설정 (필요 시)

새 PC에서 처음 작업 시:
```
git config user.name "SG솔루션"
git config user.email "sgceo@sgsolutionss.com"
```
