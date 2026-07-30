# SG CRM v3 — 작업 진행 상황

> 두 대의 PC에서 번갈아 작업합니다. **작업 시작 전 `git pull`, 작업 종료 시 이 파일 갱신 후 push.**
> 최종 갱신: 2026-07-30

---

## 현재 상태

| 항목 | 값 |
|---|---|
| 정본 파일 | `index.html` (8,013줄) |
| 최신 커밋 | `edf231f` — Claude Code 작업 규칙 CLAUDE.md 추가 |
| origin 동기화 | main ↔ origin/main 일치 (ahead 0 / behind 0) |
| 워킹트리 | clean |
| 검증 상태 | 함수 268개 / 중괄호 균형 0 / 중복 함수 없음 ✅ |
| Firebase | `sg-crm-f9adc` (Seoul) |
| 원격 | https://github.com/SGGIT-PNG/sgcrm |

---

## 완료된 작업

### Task 2 (A~E) — 통합심사 기반 구축
- **A/B** 통합심사 입력 UI (ISO 대분류에 1차·2차 심사일 + 심사일수 입력)
- **C** 인증완료 화면에 통합심사 규격 자동 반영 (`3325b03`)
- **D** ISO 갱신주기 4년 → **3년** 변경 + 기존 데이터 자동 재계산 (`b9f4c30`)
- **E** 캘린더(Apps Script) 연동 — 심사 일정 push

### Phase F — 사이클 관리
- **F.1** 인증 목록 통합심사 사이클 그룹핑 표시 (`f4a898d`)
- **F.2** 사이클 식별자 `cycleGroupId` 추가 (`3c20324`)
- **F.3+F.4** 단계 완료 시 규격 선택(빼기·부분 갱신) 모달 (`46d7889`)
  - `openCyclePhaseDoneModal(cycleGroupId, phaseIndex)` / `submitCyclePhaseDone()`

### 데이터 정합성
- 간트/업무 삭제 시 연관 인증·연간신고·캘린더 **cascade 삭제** (`13ffb5d`)
- 고아 인증서 자동 정리 (`6305554`), 정리 시 `consaudit`/`cons` 캘린더 이벤트 동반 삭제 (`996086c`)
- ISO 심사일 겹침 체크 강화 — 범위+일수 반영, **하드 블록** (`71fa4e2`)

---

### 간트 캘린더 뷰 (2026-07-30 완료)

구글 캘린더 스타일 월 그리드를 간트 페이지에 추가. 뷰 토글 `[간트][캘린더]`.

- **이벤트 소스 5종** — 지원사업 기간막대 / ISO 1차·2차 심사(별도 막대) / 인증만료 / 연간신고 / ToDo
- **ToDo `dueDate` 필드 신설** — 모달에 마감일 입력 추가, `openTodoModal(st,id)` 수정 모드 지원.
  기존 데이터는 `dueDate` 없음 → 캘린더 미표시 (하위 호환, 마이그레이션 불필요)
- **필터 공유** — `consPassesGanttFilter(c,ccs)` 헬퍼로 상태·지역·업종 필터를 두 뷰가 공유
- **레인 배정** — 다일 이벤트가 여러 날/여러 주에 걸쳐 항상 같은 줄에 정렬. 셀당 3줄 초과 시 `+N개` → 팝오버
- **뷰 모드 영속화** — `ganttViewMode`를 `app_state`에 저장

브라우저 실검증 완료 (실 Firestore 데이터: 지원사업 14 / 인증 53 / ToDo 3):
2026-06 기준 48세그먼트·`+N개` 4건 정상, 팝오버 4건 표시, 7열 균등(99px), 콘솔 오류 0.

---

### 구글 캘린더 양방향 + 주 단위 뷰 (2026-07-30)

**① 구글 캘린더 → 앱 (읽기)** — 폰·PC로 넣은 개인 일정을 앱 캘린더에 함께 표시

- `SG_CRM_Calendar_v8_Code.gs` 신규 (v7 → v8)
  - `doGet?action=list&from=&to=` 추가 → 기간 내 구글 일정을 JSON 반환
  - CRM이 만든 일정은 ScriptProperties 태그 + 제목 접두어로 **제외** (중복 방지)
  - `doPost`가 FormData(multipart)도 파싱하도록 보강 (기존 `JSON.parse` 실패 가능성)
- 앱: `loadGcalExternal()` + `gcalExternal` 캐시(표시 범위 단위), `collectGanttEvents`에 병합
- 헤더에 `구글 일정` 체크박스 + 상태 표시 — **조회 실패를 조용히 넘기지 않음**
- 앱 내장 안내 코드(`getAppsScriptCode`)가 v6으로 낡아 있어 v8로 교체 + 구버전 함수 삭제

⚠️ **사용자 조치 필요**: Apps Script를 v8로 교체 후 **새 버전으로 재배포**해야 동작.
배포 시 "액세스 권한이 있는 사용자 = 모든 사용자", "실행 = 나".

**② 캘린더 형식** — 기본은 **월 뷰**(한 줄 = 한 주, 5~6줄인 일반 달력)

> 사용자가 말한 "주단위 캘린더"는 *한 줄이 한 주인 일반 달력*을 뜻했는데
> 처음에 구글의 Week 시간표 뷰로 잘못 구현했다가 월 뷰 기본으로 정정함.
> 시간표형 주 뷰는 `[주]` 토글로 남겨둠(시간 있는 구글 일정 확인용).
> 저장 키를 `gcalMode` → `calFormat`으로 바꿔, 기본이 week였던 시절의 잔여값이 무시되게 함.

- 캘린더 뷰 안에 `[월][주]` 토글 (`gcalMode`, 기본 **월**)
- 요일 헤더 + 종일 영역 + 24시간 그리드(1시간 42px), 오전 7시로 자동 스크롤
- 시간 일정은 시작·종료 시각으로 배치, 겹치면 가로 분할, 최소 높이 18px
- 오늘 열에 현재 시각 빨간 선
- 이동 버튼이 주 단위로 동작 (`gcalPrev/gcalNext/gcalToday`, `calWeekAnchor`)

**③ 검증 자동화** — `verify.mjs` 신규 (`check.mjs` 대체)

인라인 핸들러가 부르는 함수가 window에 export됐는지 대조하는 검사를 추가했고,
이 검사로 **기존 버그 1건을 발견해 수정**: 인증 알림 탭 검색창(`oninput="renderCertAlert()"`)이
export 누락으로 **타이핑해도 반응하지 않던 상태**였음.

검증: `node verify.mjs` 전 항목 통과 (함수 285개).
브라우저 실검증 — 주 뷰 골격(7열·24시간·현재시각선), 시간 배치 계산(09:00→378px,
90분→61px, 겹침 2열 분할, 15분→최소높이), 종일 다일 일정 정상 확인.

---

### 구글 캘린더 설정을 Firebase로 이전 (2026-07-30)

기존에는 웹훅 URL이 **localStorage**에 있어 PC 2대 + 폰에서 각각 입력해야 했음.
→ `app_state/config.gcalSettings`로 옮겨 **한 번만 입력하면 모든 기기 적용**.

- `gcalSettings` 모듈 상태 신설, `getGcalSettings()`가 이를 반환
- `appStatePayload()` 추출 — app_state는 `setDoc`(전체 덮어쓰기)이라
  저장 항목을 한 곳에서 관리해야 함 (누락 시 조용히 삭제됨). `saveAppState`/`manualSave` 공용
- `loadAll`에 **1회 이전 로직** (idempotent): Firestore에 URL이 없고 localStorage에 있으면
  옮기고 콘솔 로그. 이미 옮겼으면 건너뜀
- `연동 해제` 버튼 신설 — 기존엔 한번 설정하면 끌 방법이 없었음.
  구글 캘린더의 기존 일정은 지우지 않고 앱↔구글 연결만 끊음

검증(실 Firestore): 더미 URL로 이전 동작 확인 → **localStorage를 비우고 새로고침해도
설정 유지**(= Firebase에서 로드) → `연동 해제`로 정리까지 확인. 업무 데이터 영향 없음.

### 배포된 Apps Script 진단 결과 (2026-07-30)

실제 웹훅을 찔러본 결과 **배포 버전이 v6** — v7조차 배포된 적 없음.

- ✅ FormData 전송 방식은 **정상** (`{"ok":true}`) — 이전에 의심했던 원인은 아니었음
- ❌ `action=list` 미지원 → 구글→앱 읽기는 **v8 재배포 후에만** 동작
- ⚠️ v6은 지원사업을 옛 `p.date` 형식으로 읽음 → 앱이 보내는 `startDate/endDate`와 불일치
  → **`[지원사업]` 일정이 구글 캘린더에 생성되지 않고 있을 가능성 높음** (사용자 확인 필요)
- ⚠️ ISO 1·2차 심사는 등록되나 v6은 `endDate`를 무시 → **1일짜리로만** 표시

대상 프로젝트: Apps Script `SG CRM 동기화` (사용자 확인). 배포 URL은 보안상 저장소에 기록하지 않음.

---

## 다음 할 일

- **Apps Script v8 재배포** (사용자 작업) → 그 후 웹훅 URL을 앱에 1회 입력
- 구글 캘린더 실연동 확인 (Apps Script v8 재배포 후 실제 일정이 앱에 뜨는지)
- 주 뷰 헤더/시간그리드 열 정렬(스크롤바 보정) 눈으로 재확인 — 코드는 반영됐으나 미검증
- ToDo → 구글 캘린더 전송(`gcalSyncTodo`) 배선 — 부품은 다 있고 함수만 없음

---

## 코드 구조 지도 (index.html)

### 데이터 계층
| 위치 | 내용 |
|---|---|
| L2176 | `COL` — Firestore 컬렉션 레퍼런스 (companies / consulting / consulting_company / work_items / todos / categories / certifications / cert_master / annual_reports / app_state) |
| L2190~2204 | `DEFAULT_CAT_META`, `CAT_META`, `CAT_IDS`, `CAT_COLORS` |
| L2205 | `ST` — 상태 색상 (wait/ing/done) |
| L2221~2241 | 인메모리 state — `companies` `consulting` `consCompanies` `workItems` `todos` `certifications` `certMaster` `annualReports`, `calY` `calM` `expandedCats` `ganttFilter` |
| L2243~ | 유틸 — `p2` `daysInMonth(y,m)` `dateStr(y,m,d)` `isDoneExpired(item)` |

### 간트 관련
| 위치 | 내용 |
|---|---|
| L146~230 | 간트 CSS (`.gantt-wrap` `.gantt-table` `.gantt-day-th` `.gantt-bar` 등) |
| L326 | 모바일 간트 가로 스크롤 CSS |
| L576~596 | 대시보드(overview) 내 간트 요약 — `#gantt-table` |
| **L669~714** | **간트 페이지 마크업** `#page-gantt` — 상태 토글 / 지역·업종 필터 / 월 네비 / `#gantt-table-sub` |
| L2769 | `getConsCompanies(consId)` — 활성 참여업체 JOIN |
| L2842~2893 | `ganttIsoCells()` `ganttEmptyCells()` `ganttIsoSubLabel()` |
| **L2894~3071** | **`renderGantt(sfx)`** — 메인 렌더러. head(일자) + body(대분류행 + 업체행) |
| L3072~3087 | `toggleCat` `prevMonth` `nextMonth` `goToday` `setGanttFilter` `applyGanttFilterCSS` |
| L3104 | `openConsultingModal(id)` — 대분류 편집 모달 |
| L8135 | `getConsResultSummary()` — 업체별 결과 요약 배지 |

### 기타 진입점
| 위치 | 내용 |
|---|---|
| L2730 | `navTo()` 라우팅 — `p==='gantt'` → `renderGantt('sub')` |
| L3511~3539 | `renderTodo(sfx)` `openTodoModal(st)` `saveTodo` `cycleTodo` |
| L4707 | `getCertMasterInfo(certMasterId)` |
| L4868 | `getCertDday(expDate)` |
| L4977 | `openCyclePhaseDoneModal(cycleGroupId, phaseIndex)` |
| L5297 | `openCertModal(id)` |
| L5771 | `renderAnnualReportList()` |
| **L6220~6305** | **`getCalEvents()`** — ICS 내보내기용 이벤트 수집. 캘린더 뷰 구현 시 **재사용 대상** |
| L6332 | `exportCalendar()` — ICS 생성 |
| L7756 | `openGcalModal()` — Google Calendar 연동 |
| **L8170~** | **`Object.assign(window,{...})`** — 전역 export. 새 함수는 여기 등록 필수 |

---

## 환경 (현재 PC)

- 경로: `C:\Users\WD\Desktop\sgcrm1\sgcrm`
- node v24.16.0 / npm 11.13.0 / git 2.55.0.windows.2
- git identity: `SG솔루션 <sgceo@sgsolutionss.com>` (local에 설정됨, global은 미설정)
- 검증 스크립트: `../check.mjs` (부모 폴더 `Desktop/sgcrm1/`)

⚠️ 부모 폴더에 구버전 `index.html`(2026-05-24)과 백업 70여 개가 있습니다.
**저장소 안의 `sgcrm/index.html`만 편집**하세요.
