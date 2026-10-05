# SGCRM 기능 분리 — 1단계: 데이터 주인표 + 기능 간 연결 목록

> 작성: 2026-09-27 / 기준 커밋 `a384f44` / 대상 `index.html` (10,413줄)
> **코드 변경 없음.** 현재 코드를 전수 조사한 결과만 담았다.
>
> 목표: 각 업무를 독립 기능(에이전트)으로 나누고, SGCRM은 **읽기 전용 통합 화면(뷰어)**으로 남긴다.
> 선례: ISO 심사 — iso-one이 `iso_audits`를 쓰고 CRM은 읽기만 한다.

---

## 1. 요약

| 항목 | 수치 |
|---|---|
| Firestore 쓰기 코드 | **약 100줄 / 44개 함수** (배치 포함) |
| 실시간 구독(onSnapshot) | 10개 컬렉션 전부 — 뷰어로서의 읽기 기반은 이미 갖춰져 있다 |
| **다른 영역의 데이터를 고치는 곳** | **20곳 / 16개 함수** (§3) ← 분리의 핵심 장애물 |
| **화면만 열어도 자동으로 쓰는 작업** | **9개** (§4) ← 뷰어가 되려면 가장 먼저 옮겨야 함 |
| 외부 연동 | 구글 캘린더(Apps Script 웹훅) 쓰기·읽기, 재무 PDF 분석 |

핵심 발견 두 가지:
1. **지금 CRM은 "보기만 해도 쓴다."** 페이지를 열 때마다 마이그레이션 4종, 인증→업무 반영,
   갱신 업무·ToDo 자동 생성, ISO 구글 전송이 돈다. 뷰어로 만들려면 이것부터 주인 쪽으로 옮겨야 한다.
2. **인증이 가장 많이 얽혀 있다.** 업무·ToDo·지원사업·연간신고·구글 캘린더 모두와 양방향으로 쓴다.

---

## 2. 데이터 주인표 (제안)

| 컬렉션 | 내용 | 지금 쓰는 곳 | 제안 주인 | 비고 |
|---|---|---|---|---|
| `companies` | 기업 정보 (문서 ID = 사업자번호) | CRM | **기업 에이전트** | 모든 영역의 **공통 기준 데이터**. 사업자번호가 전 컬렉션의 연결 키 |
| `consulting` | 지원사업(대분류) | CRM | **지원사업 에이전트** | |
| `consulting_company` | 지원사업 ↔ 기업 연결·진행상태 | CRM | **지원사업 에이전트** | 업무·인증이 "완료" 처리를 직접 씀 (§3) |
| `work_items` | 업무 | CRM | **업무 에이전트** | 인증이 가장 많이 직접 씀 (§3) |
| `categories` | 업무 분야 (인증 연결 설정 포함) | CRM | **업무 에이전트** | `requiresCert`·`certMasterIds`는 인증과 공유하는 설정 |
| `todos` | ToDo | CRM | **ToDo 에이전트** (또는 업무에 합침) | 인증·ISO 갱신 알림이 자동 생성함 |
| `certifications` | 인증서 (ISO는 단계마다 1건) | CRM | **인증 에이전트** | 가장 복잡. 마이그레이션 4종 포함 |
| `cert_master` | 인증 종류·주기 정의 | CRM | **인증 에이전트** | |
| `annual_reports` | 연구소 연간신고 | CRM | **인증 에이전트** (또는 별도) | 인증서에 딸린 데이터. 삭제가 인증·업무·지원사업 쪽에서 연쇄됨 |
| `iso_audits` | ISO 심사 일정 | **iso-one** | iso-one | ✅ 이미 분리 완료 |
| 구글 캘린더 | 일정 (Apps Script 경유) | CRM | **캘린더 에이전트** | 5개 영역이 각자 직접 보냄 (§5) |
| `app_state/config` | 화면 설정·구글 웹훅 URL | CRM | **CRM(뷰어)** | 뷰어에 남는 유일한 쓰기. 웹훅 URL은 캘린더 에이전트로 이전 검토 |

---

## 3. 기능 간 연결 목록 — 다른 영역의 데이터를 직접 고치는 곳

> 형식: **함수 (줄)** — 무엇을 하다가 → 어느 컬렉션을 어떻게 고치는가

### A. 인증 → 업무·ToDo (6곳) — 가장 굵은 연결
| 함수 | 줄 | 동작 |
|---|---|---|
| `syncWorkFromCert` | 3128 | 인증과 어긋난 업무를 인증 값으로 맞춤 (`work_items` 수정, 버튼) |
| `reconcileWorkFromCerts` | 3150 | 위를 전체 일괄 — **페이지 로드 때 자동** |
| `saveCertFromWork` | 5041 | 업무 완료 팝업에서 인증 등록 후 `work_items`에 인증 ID 기록 |
| `createCertTasks` | 6507~ | 갱신 임박 인증 → `work_items` + `todos` 생성 — **로드 때 자동** |
| `createIsoTasks` | 6452 | ISO 차기심사 임박 → `work_items` + `todos` 생성 — **로드 때 자동** |
| `deleteCert` | 7403 | 인증 삭제 시 연결된 **업무까지 삭제** |

### B. 업무 → 인증·연간신고·지원사업 (5곳)
| 함수 | 줄 | 동작 |
|---|---|---|
| `saveWork` | 4613 | 완료 → 미완료로 되돌리면 연결 **인증서 삭제** |
| `saveWork` | 4647 | 업무 완료 시 연결 `consulting_company`를 완료 처리 |
| `cycleWork` | 4828 | 상태 순환 중 완료 해제 시 **인증서 삭제** |
| `confirmDeleteWork` | 4684~85 | 업무 삭제 시 **인증서 + 연간신고 삭제** |
| `saveCertFromWork` | 5004~33 | 업무 화면이 인증서를 직접 생성·갱신 (A와 짝) |

### C. 인증 → 지원사업·연간신고 (3곳)
| 함수 | 줄 | 동작 |
|---|---|---|
| `syncLinkedConsDone` | 7300 | 인증 등록 시 연결 `consulting_company` 완료 처리 |
| `deleteCert` | 7404 | 인증 삭제 시 연간신고 삭제 |
| `cleanupOrphanCerts` | 5722 | 고아 인증 정리 시 연간신고 삭제 — **로드 때 자동** |

### D. 지원사업 → 인증·연간신고 (1곳)
| 함수 | 줄 | 동작 |
|---|---|---|
| `deleteConsulting` | 4434~35 | 지원사업 삭제 시 **인증서 + 연간신고 삭제** |

### E. 기업 → 전 영역 (2곳) — 기준 데이터 변경
| 함수 | 줄 | 동작 |
|---|---|---|
| `permanentDeleteCompany` | 7778~85 | 기업 완전 삭제 시 업무·인증·연간신고·지원사업연결 **전부 삭제** |
| `migrateBizno` | 7836~67 | 사업자번호 변경 시 4개 컬렉션의 `bizno`를 **전부 고쳐 씀** |

### F. 매칭 → 지원사업 (1곳)
| 함수 | 줄 | 동작 |
|---|---|---|
| `quickAddToConsulting` | 8216 | 매칭 화면에서 기업을 지원사업에 바로 추가 (`consulting_company`) |

### G. iso-one 데이터 → 인증 (2곳)
| 함수 | 줄 | 동작 |
|---|---|---|
| `applyIsoDiff` | 6586~97 | iso-one 대조 결과를 CRM 인증서에 반영 (버튼) |
| `createIsoTasks` | 6452 | (A에 포함) iso-one 일정으로 업무·ToDo 생성 |

**정리하면**: 연결은 대부분 두 종류다.
- **연쇄 삭제**(cascade) — B·C·D·E. 분리 후엔 "주인에게 삭제 요청" 또는 "고아는 주인이 스스로 정리"로 바꿔야 한다.
- **상태 전파**(A·B·C의 완료 처리, 자동 생성) — 분리 후엔 한쪽이 **사건(이벤트)을 남기고** 다른 쪽이 읽어서 처리하는 구조가 필요하다.

---

## 4. 화면만 열어도 자동으로 쓰는 작업 (`loadAll`, `startRealtimeSync`)

| # | 함수 | 줄 | 쓰는 곳 | 옮길 곳 |
|---|---|---|---|---|
| 1 | `initCertMaster` | 2486 | `cert_master` (비어 있을 때만) | 인증 에이전트 |
| 2 | (cert_master 보정 배치) | 2488~2513 | `cert_master` | 인증 에이전트 |
| 3 | `migrateCertifications` | 2530 | `certifications` | 인증 에이전트 |
| 4 | `migrateIsoCycle3yr` | 2531 | `certifications` 만료일 | 인증 에이전트 |
| 5 | `migrateCycleGroupId` | 2532 | `certifications` | 인증 에이전트 |
| 6 | `cleanupOrphanCerts` | 2533 | `certifications`·`annual_reports` 삭제 + 구글 삭제 | 인증 에이전트 |
| 7 | `reconcileWorkFromCerts` | 2535 | `work_items` | 인증↔업무 연결 처리 |
| 8 | `createIsoTasks(true)` | 2537 | `work_items`·`todos` 생성 | 업무 에이전트 (iso_audits 읽어서) |
| 9 | `createCertTasks(true)` | 2539 | `work_items`·`todos` 생성 | 업무 에이전트 (인증 읽어서) |
| + | `scheduleIsoGcalSync` | 2563 | 구글 캘린더 (iso_audits 바뀔 때) | 캘린더 에이전트 |
| + | `setDoc(app_state)` | 2457 | `app_state` | 뷰어에 남김 |

> ⚠️ 이 작업들은 **PC·노트북·폰에서 동시에 열면 동시에 돈다.** 지금까지 idempotent로 막아 왔지만,
> 주인 에이전트 하나가 정해진 시각에 한 번 돌리는 구조가 더 안전하다.

---

## 5. 구글 캘린더 전송 — 5개 영역이 각자 보냄

| 영역 | 전송을 부르는 함수 |
|---|---|
| 인증 | `saveCert`, `deleteCert`, `submitCyclePhaseDone`, `createComplexPhases`, `cleanupOrphanCerts`, `gcalSyncCert`·`gcalSyncCertIssue` |
| 지원사업 | `saveConsulting`, `deleteConsulting`, `gcalSyncCons` |
| 업무 | `confirmDeleteWork` |
| ToDo | `saveTodo`, `cycleTodo`, `deleteTodoItem`, `gcalSyncTodo` |
| 연간신고 | `deleteAnnualReport`, `gcalSyncAnnual` |
| ISO | `scheduleIsoGcalSync`, `gcalSyncIso` |

모두 `sendToGcal` → Apps Script 웹훅 한 곳으로 모인다.
→ **캘린더 에이전트**가 각 컬렉션을 읽어 "구글에 있어야 할 일정"을 계산하고 차이만 보내면,
나머지 영역은 구글을 전혀 몰라도 된다. (쿼터 초과 해결 때 ISO에 쓴 "바뀐 것만 전송" 방식의 확장)

---

## 6. 뷰어에 남을 화면 (읽기 전용)

| 화면 | 읽는 데이터 | 비고 |
|---|---|---|
| 대시보드 (`page-overview`) | 전부 | 통계 카드·간트 요약·캘린더 |
| 간트·캘린더 (`page-gantt`) | 지원사업·인증·연간신고·ToDo·ISO·구글 일정 | `collectGanttEvents`가 이미 통합 조회 |
| 통계 (`page-stats`) | 전부 | |
| 이력 (`page-history`) | 전부 | |
| 기업별 진행현황 | 전부 | |

입력 화면(업무·ToDo·고객사·인증·법인정보·매칭)은 각 에이전트로 옮기거나, 뷰어에서 **편집 버튼 → 해당 앱으로 연결**.

---

## 7. 2단계 결정을 위한 질문

1. **에이전트 형태** — iso-one 같은 별도 웹앱 / Claude 에이전트 / 조합
2. **첫 분리 대상** — 추천 순서:
   - ① **캘린더 에이전트**: 연결이 한 방향(읽기 → 구글)이라 떼기 쉽고, 5개 영역의 전송 코드가 사라진다
   - ② **인증 에이전트**: 로드 시 자동 작업 6개와 §3 연결의 대부분을 가져간다. 효과 최대, 난이도 최대
3. **연쇄 삭제 방식** — 주인에게 요청 / 고아를 주인이 주기적으로 정리 / 삭제 대신 비활성
4. **입력 위치** — 뷰어에서 입력 완전 제거 / 편집 버튼 → 해당 앱 링크
