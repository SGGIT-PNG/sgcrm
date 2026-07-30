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

## 다음 할 일

- (미정) 사용자 지시 대기

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
