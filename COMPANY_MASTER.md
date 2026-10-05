# 기업 마스터 규격 — 에이전트·업무 웹앱이 기업정보를 가져가는 법

> 작성 2026-10-05 · 원본 위치: Firebase 프로젝트 **`sg-crm-f9adc`** / Firestore 컬렉션 **`companies`**
> SG솔루션의 모든 업무 프로그램(iso-one, 메인이노, 앞으로 만들 업무별 웹앱·에이전트)은
> 기업 기본정보를 **여기서 읽는다.** 각자 따로 입력하지 않는다.

## 1. 원칙

| 항목 | 규칙 |
|---|---|
| 원본 | `companies` 컬렉션 하나. 기업 등록·기본정보 수정은 **SGCRM에서만** 한다 |
| 마스터 키 | **사업자등록번호** = 문서 ID (`000-00-00000`, 하이픈 포함) |
| 사업자 미등록 | 예비창업자는 임시 ID `TEMP-001` 형식. 사업자 등록 후 SGCRM 「사업자번호 변경」으로 전환된다 |
| 자료 원천 | 구글 드라이브 `관리 업체 List / 시도 / 업체 폴더`와 그 안의 업체카드(`<번호>_업체카드_<업체명>.md`) |
| 가져가는 방식 | **읽어 가기(pull).** SGCRM이 각 앱에 밀어 넣지 않는다. 앱이 꺼져 있어도 다시 켜지면 따라잡을 수 있게 |
| 고치기 | 다른 앱은 `companies`를 **고치지 않는다.** 바뀐 사실을 알면 SGCRM에서 고친다 |

## 2. 필드

| 필드 | 뜻 | 예 |
|---|---|---|
| (문서 ID) | 사업자등록번호 | `845-81-04072` |
| `name` | 기업명 | `㈜청림테크` |
| `ceo` | 대표자 | `김태후` |
| `bizclass` | 기업 구분 `법인` / `개인` / `예비` | `법인` |
| `corpNo` | 법인등록번호 | |
| `addr` | 사업장 주소 | |
| `region` | 시도 (서울·경기·…·제주) | `경기` |
| `biztype` | 업종(자유 기술) | `제조업 · LED표지판·안내판 제조` |
| `industry` | 업종 분류 `제조`/`IT`/`바이오`/`서비스`/`건설`/`유통`/`농업`/`에너지`/`기타` | `제조` |
| `scale` | `소기업`/`중기업`/`중견기업`/`대기업` | `소기업` |
| `revenue` | 매출 구간 | `10억미만` |
| `estDate` | 사업개시일 `YYYY-MM-DD` (업력 계산 기준) | `2026-01-28` |
| `regDate` | 법인 등기일 | |
| `tel` `email` | 연락처 | |
| `group` | 고객 그룹 `주요고객`/`일반고객`/`잠재고객`/`휴면`/`계약종료` | |
| `active` | `Y` 사용 / `N` 비활성 | `Y` |
| `compNo` | **업체번호** (업체카드 번호, 3자리) | `001` |
| `driveFolderId` | 드라이브 업체 폴더 ID | |
| `driveFolderName` | 드라이브 업체 폴더 이름 | `용인_(주)청림테크_김태후대표님` |
| `driveCardId` | 업체카드 파일 ID | |
| `createdAt` `updatedAt` | 밀리초 타임스탬프 | |

`compNo`·`drive*`는 2026-10-05에 추가됐다. 드라이브와 연결되지 않은 기업은 비어 있다.

## 3. 읽는 법

### 웹앱 (브라우저, Firebase JS SDK)
```js
const crm = initializeApp({ /* sg-crm-f9adc 설정 — SGCRM index.html과 같은 값 */ }, 'sgcrm');
const db  = getFirestore(crm);
onSnapshot(collection(db, 'companies'), snap => {
  const list = snap.docs.map(d => ({ bizno: d.id, ...d.data() }))
                        .filter(c => c.active !== 'N');
  // 자기 앱의 기업 목록과 bizno로 맞춘다
});
```

### 서버·에이전트 (REST, 읽기)
```
GET https://firestore.googleapis.com/v1/projects/sg-crm-f9adc/databases/(default)/documents/companies?pageSize=300&key=<웹 API 키>
```

> ⚠️ 2026-10-05 현재 SGCRM에는 로그인이 없고 Firestore를 인증 없이 읽을 수 있다(보안 잠금 보류 중).
> 잠금을 적용하면 위 읽기 방식도 바뀐다 — 그때 이 문서를 갱신한다.

## 4. 앱별 현황

| 앱 | 지금 기업정보 | 할 일 |
|---|---|---|
| SGCRM | `companies` 원본 | — |
| iso-one (`ims-project`) | 자체 회사 목록(`DATA.cos`), `iso_audits`를 bizno로 CRM에 미러 | 회사 등록 시 `companies`에서 골라 가져오기 (별도 코딩창) |
| 메인이노 (`mainbiz-innobiz`) | 자체 DB `companies`(프로필 JSON, 사업자번호 하이픈 없는 10자리) | 고객사 등록 시 `companies`에서 가져오기. 하이픈 제거해 비교 (노트북 담당) |
