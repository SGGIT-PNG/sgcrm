# CERT_STATUS_SPEC — 인증 결과를 SGCRM에 넘기는 공통 양식 (v1)

> 작성 2026-10-13 · 대상 Firebase 프로젝트 `sg-crm-f9adc` · 문서 주인: SGCRM 저장소
> **이 문서를 iso-one(`ims-project`)·메인이노(`mainbiz-innobiz`) 개발 창에 그대로 붙여 넣어 쓴다.**
> 원칙(`WORK_STRUCTURE.md` 8장): 입력은 각 업무 프로그램에서만. SGCRM은 읽어서 보여 주고 통계만 낸다.

---

## 1. 한 장 요약

```
iso-one ─┐                          ┌─ 인증·갱신 화면 (현황·갱신 알림)
메인이노 ─┼─▶ Firestore cert_status ─┼─ 통계 (취득·갱신·만료)
(앞으로 벤처·연구소 프로그램) ┘      └─ 할 일 자동 생성 (갱신 D-90 등)
             + cert_events(선택)
```

- **각 프로그램은 「기업 × 인증」 하나당 문서 하나(`cert_status`)를 최신 상태로 덮어쓴다.**
- 진행 과정(신청·심사·발급)을 남기고 싶으면 `cert_events`에 한 줄씩 추가한다(선택).
- SGCRM은 이 두 컬렉션을 **읽기만** 한다. 고치지 않는다.
- 같은 기업·인증을 두 프로그램이 동시에 쓰지 않는다 — 인증 종류마다 주인 프로그램은 하나(§4).

---

## 2. `cert_status` — 기업 × 인증의 현재 상태

### 2-1. 문서 ID (중복 방지의 핵심)
```
{사업자번호}__{인증코드}            예) 257-88-03412__mainbiz
                                     257-88-03412__iso_9001
```
- 사업자번호는 SGCRM `companies` 문서 ID와 **똑같이** 하이픈 포함 `000-00-00000`(예비창업자는 `TEMP-012`).
  메인이노는 하이픈 없이 저장하므로 **보낼 때 하이픈을 넣는다**(`2578803412` → `257-88-03412`).
- 같은 ID로 다시 쓰면 덮어쓴다(= 최신 상태). 갱신해서 새 인증서를 받아도 **같은 문서**를 고친다. 지난 인증서 기록은 `cert_events`에.

### 2-2. 인증코드 (`cert`) — SGCRM `cert_master` ID와 같게

| 코드 | 이름 | 주인 프로그램 |
|---|---|---|
| `iso_9001` `iso_14001` `iso_45001` `iso_22000` `iso_37001` `iso_37301` `iso_13485` | ISO 각 규격 | **iso-one** |
| `mainbiz` | 메인비즈 | **메인이노** |
| `innobiz` | 이노비즈 | **메인이노** |
| `venture` | 벤처기업 | (미정 — 프로그램 생기기 전까지 SGCRM 수기 기록 유지) |
| `lab` `rnd_dept` | 기업부설연구소·연구개발전담부서 | (미정) |
| `direct_prod` | 직접생산확인 | (미정) |

> ISO 통합심사(9001+14001+45001)는 **규격마다 문서 하나씩** 쓴다(만료일이 같아도). 통계·갱신을 규격 단위로 세기 때문이다.
> 새 인증 종류가 필요하면 SGCRM `cert_master`에 먼저 코드를 만들고 이 표에 추가한다.

### 2-3. 필드

| 필드 | 형식 | 필수 | 뜻 |
|---|---|---|---|
| `bizno` | `257-88-03412` | ✅ | 사업자번호 (문서 ID 앞부분과 같게) |
| `cert` | `mainbiz` | ✅ | 인증코드 (§2-2) |
| `companyName` | 문자열 | ✅ | 보낸 시점의 기업명 사본 (CRM 기업이 지워져도 읽히게) |
| `status` | 아래 값 중 하나 | ✅ | 현재 상태 |
| `stage` | 문자열 | | 진행 중일 때 세부 단계. 자유 기술: `서류 준비` `신청 접수` `1단계 심사` `2단계 심사` `현장평가` `보완 요청` … |
| `issuedAt` | `YYYY-MM-DD` | 취득 시 ✅ | 현재 유효한 인증서의 발급(취득)일 |
| `expiresAt` | `YYYY-MM-DD` | 취득 시 ✅ | 현재 인증서의 만료일 |
| `certNo` | 문자열 | | 인증서 번호 |
| `grade` | 문자열 | | 등급·점수 등 (예: 메인비즈 `성장형`, `750점`) |
| `nextAction` | 문자열 | | 다음에 해야 할 일 (예: `ISO 9001 사후심사(1차)`, `갱신 신청`) |
| `nextDue` | `YYYY-MM-DD` | | 그 일의 마감 (예: 차기심사 마감, 갱신 신청 시작일) |
| `source` | `iso-one` / `mainbiz-innobiz` / … | ✅ | 쓴 프로그램 |
| `sourceRef` | 문자열 | | 그 프로그램 안의 ID (iso-one `auditId`, 메인이노 진단·보유인증 ID) |
| `link` | URL | | 그 프로그램에서 이 기업·인증을 여는 주소 (CRM의 「○○에서 열기」 버튼) |
| `updatedAt` | 밀리초 숫자 | ✅ | 마지막으로 쓴 시각 (`Date.now()`) |
| `updatedBy` | 문자열 | | 누가 처리했는지 (`정석진` `김학미` `자동`) |

**`status` 값 (이 여섯 개만)**

| 값 | 뜻 | CRM 표시 |
|---|---|---|
| `preparing` | 상담·서류 준비 중 (아직 신청 전) | 진행 |
| `in_progress` | 신청 후 심사·평가 진행 중 | 진행 |
| `certified` | 유효한 인증 보유 | 유효 (만료 90일 전부터 CRM이 「갱신 대상」으로 계산) |
| `expired` | 만료됨 (갱신 안 함) | 만료 |
| `failed` | 불합격·반려 | 불합격 |
| `dropped` | 진행 중단·고객 포기 | 중단 |

- **「갱신 대상」은 따로 보내지 않는다.** `certified` + `expiresAt`로 CRM이 계산한다(기준 D-90, CRM 설정).
- 갱신 심사 중이면 `status=in_progress`, `issuedAt`·`expiresAt`은 **기존 인증서 값 유지**, `stage=갱신 심사`. 새 인증서가 나오면 `certified` + 새 날짜로 덮어쓴다.
- 모르는 값은 **필드를 빼고 보낸다.** 빈 문자열·0으로 채우지 않는다.

### 2-4. 예시

```json
// cert_status/257-88-03412__mainbiz
{
  "bizno": "257-88-03412", "cert": "mainbiz", "companyName": "주식회사 하이퍼다인",
  "status": "certified", "issuedAt": "2026-10-20", "expiresAt": "2029-10-19",
  "grade": "성장형", "certNo": "M-2026-01234",
  "nextAction": "갱신 신청", "nextDue": "2029-07-21",
  "source": "mainbiz-innobiz", "sourceRef": "holding-17",
  "link": "https://<메인이노 주소>/app/#/companies/17/certifications",
  "updatedAt": 1791900000000, "updatedBy": "김학미"
}
```
```json
// cert_status/123-45-67890__iso_9001  (통합심사 중 — 14001·45001도 같은 모양으로 각각)
{
  "bizno": "123-45-67890", "cert": "iso_9001", "companyName": "주식회사 더트라이",
  "status": "certified", "issuedAt": "2025-03-21", "expiresAt": "2028-03-20",
  "nextAction": "ISO 9001·14001·45001 사후심사(2차)", "nextDue": "2027-03-20",
  "source": "iso-one", "sourceRef": "a3", "updatedAt": 1791900000000, "updatedBy": "정석진"
}
```

---

## 3. `cert_events` — 진행 기록 (선택)

과정을 CRM 이력·통계에 남기고 싶을 때 **추가만** 한다(고치거나 지우지 않음). 문서 ID는 자동.

| 필드 | 형식 | 뜻 |
|---|---|---|
| `bizno` `cert` `companyName` | §2-3과 같음 | |
| `type` | `apply`(신청) / `audit`(심사·평가) / `supplement`(보완) / `issued`(발급) / `renewed`(갱신 발급) / `expired` / `failed` / `dropped` | 무슨 일 |
| `date` | `YYYY-MM-DD` | 그 일이 있었던 날 |
| `note` | 문자열 | 짧은 메모 (개인정보 금지) |
| `source` `sourceRef` `by` | | 쓴 프로그램·ID·사람 |
| `createdAt` | 밀리초 숫자 | 기록 시각 |

같은 일을 두 번 보내지 않도록, 보낼 때 **문서 ID를 `{source}__{sourceRef}__{type}__{date}`**로 지정해도 된다(다시 보내면 덮어씀).

---

## 4. 쓰는 방법 — 로그인·권한 (2026-10-08부터 Firestore 잠김)

`sg-crm-f9adc`는 **허용된 구글 계정(현재 `sgceo@sgsolutionss.com`)만** 읽고 쓸 수 있다(`SECURITY_PLAN.md` §1-2). 로그인 없는 쓰기·API 키만으로 하는 쓰기는 **403**으로 막힌다.

| 프로그램 | 쓰는 방법 |
|---|---|
| **iso-one** (브라우저 웹앱) | 이미 쓰는 「CRM 연결 로그인」(sgceo 구글 로그인, 보조 Firebase 앱 `sg-crm-f9adc`)으로 `cert_status`·`cert_events`에 쓴다. `iso_audits`를 쓰는 곳 바로 옆에서 같이 쓰면 된다 |
| **메인이노** (Python 서버) | 서버라 브라우저 로그인이 없다 → **서비스 계정**(Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키)으로 Firestore에 쓴다. 키 파일은 서버 비밀값으로만 두고 저장소·로그에 넣지 않는다. 서비스 계정은 보안 규칙이 아니라 IAM 권한으로 판단하므로 잠긴 규칙과 상관없이 동작한다 |
| 앞으로의 에이전트 | 할 일 쓰기 창구(Cloudflare Worker, `TODO_ARCHITECTURE.md` §5)에 `cert_status` 쓰기 경로를 추가하는 방안도 가능 — 그때 결정 |

> ⚠️ 2단계 규칙(`TODO_ARCHITECTURE.md` §4-2)에서 직접 쓰기를 막는 컬렉션 목록에 `cert_status`는 **넣지 않는다**(iso-one이 직접 쓰기 때문). 바꾸게 되면 이 문서를 먼저 고친다.

### 4-1. 언제 쓰나
- 상태·날짜·단계가 **바뀔 때마다** 그 기업·인증 문서를 덮어쓴다(`set` 전체 덮어쓰기 또는 `merge`).
- 처음 연결할 때 **지금 가진 기록 전부를 한 번** 보낸다(초기 적재). 같은 ID라 여러 번 보내도 안전하다.
- 삭제: 잘못 만든 진단·기록을 지웠으면 `cert_status`도 지운다(그 프로그램이 주인인 문서만).

### 4-2. 보내기 전 점검 (각 프로그램 쪽)
1. `bizno`가 SGCRM `companies`에 있는지 확인 — 없으면 보내지 말고 「CRM에 먼저 기업 등록」 안내(CRM은 기업 등록의 원본).
2. `cert`가 §2-2 표에 있는 코드인지.
3. `certified`인데 `issuedAt`·`expiresAt`이 없으면 보내지 않는다.
4. 날짜는 `YYYY-MM-DD`(시간대 Asia/Seoul 기준 날짜).

---

## 5. SGCRM이 하는 일 (이 문서의 상대편 — SGCRM 저장소 작업)

- 인증·갱신 화면: `cert_status`를 기업·인증별 한 줄로 표시. 「○○에서 열기」 버튼 = `link`. 입력 버튼은 해당 프로그램이 주인인 인증부터 없앤다.
- 갱신 알림: `certified` + `expiresAt` D-90 이내 → 갱신 대상, 지남 → 만료(표시만). `nextDue`가 있으면 그 날짜 우선.
- 할 일 자동 생성: **할 일 쓰기 창구(할 일 프로그램 Worker)의 매일 06:00 예약 작업**이 맡는다(CRM은 2026-10부터 할 일을 직접 쓰지 않음, `TODO_READONLY`). 그 예약 작업에 `cert_status` 읽기를 추가해야 한다 — `certified` + `expiresAt` D-90 이내면 「[기업] ○○ 갱신 준비」(마감=만료일, `source:'cert'`, `dedupeKey='cert:cs:'+문서ID`), `nextDue`가 있으면 「[기업] nextAction」(마감=nextDue, `dedupeKey='cert:cs:'+문서ID+':'+nextDue`). 같은 기업·인증의 옛 수기 기록(`certifications`)으로는 만들지 않는다. **→ 할 일 프로그램 개발 창 작업.**
- (2026-10-13 구현) 할 일 프로그램 `worker/src/auto.js` — 매일 06:00 `cert_status` 읽어 위 규칙대로 생성. **`nextDue`가 있으면 그것만**(없을 때만 만료 D-90 갱신 준비), 둘 다 **D-90 안**일 때만. ISO 통합심사처럼 같은 기업·같은 nextDue·같은 nextAction은 할 일 하나. 연동된 기업·인증은 `certifications`·`iso_audits`(같은 마감)로 만들지 않음. `expired`·`failed`·`dropped`는 안 만듦.
- (2026-10-13 구현) CRM 인증·갱신 화면 「🔗 연동 현황」 탭, 대시보드 갱신 배너·인증 요약·사이드바 숫자에 반영, 겹치는 수기 기록은 갱신 알림에서 뺌.
- 통계: 인증별 취득·갱신·만료 건수, 월별 발급, 기업별 보유 인증.
- 구글 캘린더: 인증 갱신 일정만(약속 위주 원칙, `WORK_STRUCTURE.md` 8장).
- **기존 수기 기록(`certifications`)과의 관계**: 같은 기업·인증의 `cert_status`가 들어오면 CRM 화면은 `cert_status`를 우선 보여 주고, 수기 기록은 「옛 기록」으로 접는다. 수기 기록 정리(삭제)는 확인 후 따로 한다.

---

## 6. 각 개발 창에 전달할 요청 (복사용)

**iso-one 개발 창에:**
> SGCRM `CERT_STATUS_SPEC.md` v1에 맞춰, 심사 결과가 바뀔 때 `sg-crm-f9adc`의 `cert_status`(규격마다 문서 하나, ID `{사업자번호}__iso_9001` 형식)를 쓰는 기능을 추가해 줘. `iso_audits` 미러를 쓰는 곳 옆에서 같은 CRM 연결 로그인으로 쓰면 된다. `status`는 진행중 심사면 `in_progress`, 발급 완료면 `certified`(issuedAt=발급일, expiresAt=만료일), `nextAction`/`nextDue`는 지금 미러에 넣는 차기심사 유형·마감을 그대로. 처음 한 번 전체 기록을 보내는 버튼(초기 적재)도 만들어 줘. `cert_events`는 선택.

**메인이노 개발 창에:**
> SGCRM `CERT_STATUS_SPEC.md` v1에 맞춰, 보유 인증(`certification_holdings`)과 진행 중 진단이 바뀔 때 Firebase `sg-crm-f9adc`의 `cert_status`(ID `{하이픈 넣은 사업자번호}__mainbiz` / `__innobiz`)를 쓰는 기능을 추가해 줘. 서버이므로 서비스 계정 키(환경변수 경로, 저장소에 넣지 않음)로 Firestore에 쓴다. 보유 인증 → `certified`(취득일·만료일), 진행 중 진단 → `in_progress`(stage=평가 단계 이름), 확정 후 불합격 → `failed`. CLI에 「CRM 전체 보내기」(초기 적재)도 만들어 줘. 기업 프로필의 사업자번호가 CRM `companies`에 없으면 보내지 말고 알려 줘.

---

## 7. 바꿀 때
- 필드를 **추가**하는 것은 언제든(CRM은 모르는 필드를 무시). 이름을 바꾸거나 지우는 것은 버전을 올리고(v2) 세 저장소가 함께 바꾼다.
- 이 문서의 원본은 SGCRM 저장소. 다른 저장소에는 복사본을 두되 「원본: sgcrm/CERT_STATUS_SPEC.md vN」을 적는다.
