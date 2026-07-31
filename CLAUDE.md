# SG솔루션 CRM v3 — Claude Code 작업 지침

이 저장소에서 Claude Code가 따라야 할 규칙입니다. 세션마다 자동으로 읽힙니다.
**최종 갱신: 2026-07-31**

---

## 1. 프로젝트 개요

| 항목 | 값 |
|---|---|
| 정본 파일 | **`<repo>/index.html`** — 단일 HTML 파일 (2026-07-31 기준 **8,442줄**) |
| 저장소 | https://github.com/SGGIT-PNG/sgcrm (branch `main`) |
| 배포 | **GitHub Pages** — `main`에 push하면 즉시 배포됨 |
| Firebase | 프로젝트 **`sg-crm-f9adc`** (Firestore, Seoul) |
| Apps Script | 구글 캘린더 연동용. 프로젝트명 **`SG CRM 동기화`** (별도 재배포 필요) |
| 검증 스크립트 | `verify.mjs` (저장소 안) |

빌드 도구·번들러·패키지 매니저 없음. HTML 파일 하나에 CSS·JS가 전부 들어 있고,
Firebase는 CDN ESM import로 씁니다.

### ⚠️ 정본 파일 위치 — 가장 흔한 사고

**`sgcrm/index.html` 만이 정본입니다.**

부모 폴더(`Desktop/sgcrm1/`)에 `index.html`(2026-05-24 구버전)과
`index_2604xx_vNN.html` 형태의 백업이 70여 개 있으나 **모두 과거 스냅샷**입니다.
절대 그쪽을 편집하지 마세요. 편집 전 항상 경로에 `sgcrm\` 이 들어있는지 확인할 것.

부모 폴더의 `check.mjs`도 구버전입니다. 저장소 안의 `verify.mjs`를 쓰세요.

---

## 2. 작업 규칙 (사장님 지시, 2026-07-31)

### 응답 언어
- 항상 **한국어**로 응답
- 코드 주석 한국어 / 커밋 메시지 한국어

### 코드 수정 후 검증 — 필수
수정할 때마다 저장소 폴더에서 아래를 실행하고, **전부 ✅ 여야** 다음 단계로 갑니다.

```bash
node verify.mjs
```

`verify.mjs`가 검사하는 것 (`node --check` 문법 검증을 **포함**합니다):

1. **문법 오류** — `<script type="module">` 블록을 추출해 `node --check`
2. **중괄호 균형 0 / 중복 함수 없음**
3. **Firebase(sg-crm-f9adc) 참조 · `Object.assign(window,…)` 존재**
4. **인라인 핸들러 ↔ window export 대조** ← 이 코드베이스 특유의 사고 유형
   `onclick="foo()"` 인데 `foo`가 window에 export 안 되면 **문법은 통과하지만
   버튼이 눌리지 않습니다.** 새 전역 함수를 만들면 반드시 export 목록에 추가.

실패 시 `exit code 1`. **검증 실패면 커밋하지 말고** 원인을 보고하고 롤백 여부를 확인합니다.

### GitHub push — 사장님이 "올려줘"라고 할 때만

> 🔴 **2026-07-31 규칙 변경.** 이전 지침은 "의미 있는 수정 후 자동 커밋·푸시"였으나,
> **사장님 지시로 폐기**했습니다. 이제 임의로 push하지 않습니다.

- **push는 사장님이 "올려줘"라고 명시할 때만** 실행합니다.
- 커밋도 지시가 없으면 하지 않습니다. 수정 후에는 검증 결과와 변경 요약만 보고하고 대기.
- `main` push = **즉시 GitHub Pages 배포**임을 항상 유의.
- 커밋 메시지는 한국어 한 문장 요약 + `Co-Authored-By: Claude` trailer.

### git identity (새 PC 최초 1회)

```bash
git config user.name "SG솔루션"
git config user.email "sgceo@sgsolutionss.com"
```

---

## 3. 멀티 PC 작업 규칙 ⚠️

**PC와 노트북 두 대에서 번갈아 작업합니다. 정본이 단일 파일이라 병합 충돌 위험이 큽니다.**

| 시점 | 반드시 할 것 |
|---|---|
| **작업 시작** | `git pull` — **첫 파일 편집 전에 필수** |
| 시작 직후 | 커밋 안 된 로컬 변경이 있으면 **먼저 사장님에게 보고**하고 지시 대기 |
| 시작 직후 | `PROGRESS.md`를 읽어 직전(다른 기기) 작업 맥락 파악 |
| **작업 종료** | `PROGRESS.md` 갱신 → 사장님이 "올려줘" 하면 커밋·push |

- **한 번에 한 기기에서만 수정합니다.** 8,000줄짜리 단일 HTML이라 양쪽에서 고치면
  자동 병합이 거의 불가능하고, 충돌 해결 중 코드 유실 위험이 큽니다.
- 충돌이 발생하면 **편집을 중단하고 사장님에게 보고**합니다. 임의로 해결하지 않습니다.
- 다른 기기에서 push한 게 있는데 pull을 안 하면, 로컬 편집분이 통째로 충돌합니다.

### 기기별 경로 (동일 저장소)

| 기기 | 경로 |
|---|---|
| PC | `C:\Users\WD\Desktop\sgcrm1\sgcrm` |
| 노트북 | `C:\Users\swanh\Desktop\sgcrm1\sgcrm` |

환경: node **v24.16.0** / git 2.55.0.windows

---

## 4. index.html 내부 구조

`<head>` CSS → `<body>` 페이지 마크업 → `<script type="module">`(L2278~) 로직 순서.

### 4-1. 페이지(섹션) 구성

`.page-section` div 하나가 화면 한 개. `navTo(page)`가 표시 전환 + 렌더러 호출.

| 줄 | id | 내용 |
|---|---|---|
| L642 | `page-overview` | 대시보드 — 통계 카드 + 간트 요약 + 캘린더 |
| **L748** | **`page-gantt`** | **간트 페이지 — 간트/캘린더 뷰 토글** |
| L829 | `page-todo` | ToDo |
| L834 | `page-work` | 업무 관리 (카테고리별) |
| L852 | `page-clients` | 고객사 |
| L875 | `page-stats` | 통계 |
| L878 | `page-cert` | 인증 관리 (인증목록/알림/마스터 탭) |
| L952 | `page-history` | 이력 |
| L993 | `page-matching` | 매칭 |
| L1078 | `page-companies` | 법인 정보 |

### 4-2. 데이터 계층

| 줄 | 내용 |
|---|---|
| L2278 | `<script type="module">` 시작 |
| L2282~2290 | `firebaseConfig` / `initializeApp` |
| L2294 | `COL` — Firestore 컬렉션 (companies / consulting / consulting_company / work_items / todos / categories / certifications / cert_master / annual_reports / app_state) |
| L2309~2323 | `DEFAULT_CAT_META`, `CAT_COLORS`, `ST`(상태 색상 wait/ing/done) |
| L2339~2359 | 인메모리 state — `companies` `consulting` `consCompanies` `workItems` `todos` `certifications` `certMaster` `annualReports` / UI 상태 `calY` `calM` `expandedCats` `ganttFilter` `ganttViewMode` `gcalSettings` |
| L2368~2379 | 유틸 — `p2` `daysInMonth` `dateStr` `openModal/closeModal` `badge` `isDoneExpired` |
| L2391 | `loadAll()` — 최초 로드 + 1회성 마이그레이션 |
| L2503 | `startRealtimeSync()` — onSnapshot 구독 |

### 4-3. 간트 페이지 (L748 마크업 / L3000~3664 로직)

CSS: L146~230 간트(`.gantt-wrap` `.gantt-bar` 등), **L238~270 캘린더 뷰(`.gcal-*`)**, L404 모바일.

| 줄 | 함수 | 역할 |
|---|---|---|
| L3000~3051 | `ganttIsoCells` `ganttEmptyCells` `ganttIsoSubLabel` | 간트 셀 생성 |
| L3052 | **`consPassesGanttFilter(c,ccs)`** | **상태·지역·업종 필터 — 간트/캘린더 두 뷰가 공유** |
| **L3084** | **`renderGantt(sfx)`** | 간트 메인 렌더러 (head 일자 + 대분류행 + 업체행) |
| L3230~3247 | `toggleCat` `prevMonth` `nextMonth` `goToday` `setGanttFilter` | 간트 조작 |
| L3263~3311 | `gcalExternalOn` `loadGcalExternal` `updateGcalExtStatus` `toggleGcalExternal` | 구글 캘린더 **읽기**(외부 일정) |
| **L3312** | **`collectGanttEvents(rs,re)`** | **캘린더 이벤트 수집 — 지원사업/ISO 1·2차 심사/인증만료/연간신고/ToDo/구글일정** |
| L3384~3423 | `gcalEvHtml` `assignEventLanes` `hmToMin` `ensureGcalExternal` | 이벤트 렌더 보조 (레인 배정 = 다일 이벤트 줄맞춤) |
| L3436 | `renderGanttCalendar(sfx)` | 캘린더 뷰 진입점 |
| L3450 | `renderGcalMonth(sfx)` | **월 뷰** (한 줄=한 주, 기본값) |
| L3488 | `renderGcalWeek(sfx)` | 주 뷰 (24시간 시간표) |
| L3602~3649 | `setGcalMode` `gcalPrev/Next/Today` `openGcalDay` `closeGcalDay` | 캘린더 조작 + `+N개` 팝오버 |
| L3650 | `renderGanttView()` | 현 뷰 모드에 맞게 재렌더 |
| L3661 | `setGanttView(mode)` | `[간트][캘린더]` 토글 (`ganttViewMode` 영속화) |

### 4-4. 주요 기능 진입점

| 줄 | 함수 |
|---|---|
| L2849 | **`appStatePayload()`** — app_state 저장 항목 단일 소스 (§5 참조) |
| L2876 | `navTo(page)` 라우팅 |
| L3681 | `openConsultingModal(id)` — 대분류(지원사업) 편집 |
| L3758 | `findConsAuditConflict(...)` — ISO 심사일 겹침 **하드 블록** |
| L4088~4148 | `renderTodo` `openTodoModal(st,id)` `saveTodo` `cycleTodo` (`dueDate` 지원) |
| L4436 | `cycleWork(itemId)` — 업무 상태 순환 |
| L5177~5283 | 마이그레이션 — `migrateIsoCycle3yr` `migrateCycleGroupId` `cleanupOrphanCerts` |
| L5585 | `openCyclePhaseDoneModal(cycleGroupId, phaseIndex)` — 단계 완료 모달 |
| L5629 | `submitCyclePhaseDone()` |
| L5905 | `openCertModal(id)` / L5990 `createComplexPhases(...)` |
| L6201 | `deleteCert()` — cascade 삭제 |
| L6379 | `renderAnnualReportList()` — 연간신고 |
| L6828 | `getCalEvents()` — **ICS 내보내기용** 이벤트 수집 (캘린더 뷰의 `collectGanttEvents`와 별개) |
| L6940 | `exportCalendar()` — ICS 생성 |
| L8340~8455 | `getGcalSettings` `saveGcalSettings` `clearGcalSettings` `openGcalModal` `testGcalConnection` |
| L8457~8587 | `sendToGcal` `gcalSyncCert` `gcalSyncAnnual` `gcalSyncCons` `syncGcalAll` — 앱→구글 **쓰기** |
| L8588 | `getAppsScriptCode()` — 앱 내장 Apps Script 안내 코드 (v8) |
| L8721~8795 | 모바일 — `toggleMobileDrawer` `mobileNavTo` `initMobileSwipe` |
| **L8891** | **`Object.assign(window,{...})`** — 전역 export. **새 함수는 여기 등록 필수** |

---

## 5. app_state 저장 규칙 ⚠️

`app_state/config`는 `setDoc`(**전체 덮어쓰기**)으로 저장합니다.
저장 항목은 **`appStatePayload()`(L2849) 한 곳**에서만 만듭니다.

**새 설정을 추가하면 반드시 `appStatePayload()`에 넣으세요.**
빠뜨리면 다른 저장이 일어날 때 그 값이 **조용히 지워집니다.**

사용자 설정(구글 캘린더 웹훅 URL 등)은 localStorage가 아니라 여기에 둡니다.
→ PC·노트북·폰 어디서 열어도 동일하게 적용됩니다.

---

## 6. 데이터 안전

- Firebase Firestore 데이터를 **직접 삭제하거나 임의 변경 금지**
- 구글 캘린더 일정 삭제는 **반드시 목록을 먼저 뽑아 사장님 확인 후** 진행
- 마이그레이션 함수는 **idempotent**(중복 실행 안전) + 콘솔 로그 필수
- 대량 배치는 500 op 이하로 분할

---

## 7. 코드 스타일 (기존 관행 유지)

- 단일 HTML 파일, `<script type="module">` 내부에 전체 로직
- 새 전역 함수는 파일 끝 `Object.assign(window,{...})`(L8891)에 **반드시 등록**
  (누락 시 `onclick="..."` 인라인 핸들러가 동작하지 않음 — `verify.mjs`가 잡아줌)
- 렌더 함수는 `render*(sfx)` 패턴 — `sfx`가 `'sub'`이면 전용 페이지, `''`이면 대시보드 요약
- 스타일은 인라인 `style` 또는 `<head>`의 `<style>`에 CSS 변수(`var(--surface)` 등) 사용

### 브라우저 실검증 (권장)

문법 검사로는 못 잡는 오류(런타임 참조, 레이아웃 깨짐)가 많습니다.
가능하면 브라우저로 열어 **콘솔 오류 0**을 확인하고 바뀐 화면을 눈으로 봅니다.
Firestore **읽기는 안전**하지만, 월 이동·뷰 전환은 `app_state`(UI 상태)에 **쓰기**가
발생하므로 점검 후 원래 값으로 되돌립니다.
