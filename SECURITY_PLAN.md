# Firestore 잠금 계획 (제안 — 아직 적용 안 함)

> 작성 2026-10-07 · 대상 Firebase 프로젝트 `sg-crm-f9adc`
> 저장소에 `firestore.rules`가 없다. 규칙은 Firebase 콘솔에만 있다(콘솔 → Firestore → 규칙).

## 1. 지금 상태 (2026-10-07 확인)

| 시험 | 결과 |
|---|---|
| `companies`·`todos` 읽기 — 로그인 없이, API 키만 | **200 (읽힘)** |
| `companies` 읽기 — **API 키도 없이** | **200 (읽힘)** |
| `todos` 쓰기 — 로그인 없이 | **됨**: 드라이브 스크립트 v5가 API 키만으로 `todos`에 새 문서를 만들고 있다(10/6 음성 할 일 2건) |
| `companies` 쓰기 — 로그인 없이 | **됨**: CRM에 로그인 기능이 없는데 기업 등록·수정이 저장된다 |

→ **누구든 주소만 알면 고객사 정보(사업자번호·법인번호·주소·매출 구간)를 읽고, 고치고, 지울 수 있다.**
API 키는 공개 저장소의 `index.html`에 있어 비밀이 아니다(키가 없어도 읽힌다).
쓰기는 시험 삼아 데이터를 바꾸지 않고, 위 실제 동작으로 판단했다.

### 1-1. 현재 게시된 규칙 (2026-10-07 콘솔 캡처 — 되돌리기용 원본)
콘솔 표시 게시 시각 **2026-04-20 오후 8:45** (이전 이력 4/20 오전 9:20, 4/19 오후 7:32). 콘솔 경고: 「보안 규칙이 공개로 정의되어 있어 누구나 데이터를 도용·수정·삭제할 수 있습니다」.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 2. 막는 방법 (제안)

### 2-1. CRM 화면 — 구글 로그인 + 두 대표 계정만
- Firebase Authentication에서 **Google 로그인**을 켜고, 승인 도메인에 `sggit-png.github.io`를 넣는다.
- CRM을 열면 구글 로그인 버튼 → 허용된 메일이면 그대로 쓰고, 아니면 「권한 없음」.
- TV는 sgceo 계정으로 한 번 로그인해 두면 계속 유지된다.

### 2-2. 규칙 초안

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function staff() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
             'sgceo@sgsolutionss.com'   // 두 대표 공용 계정(10/7). 계정을 나누면 추가
           ];
    }
    match /{document=**} {
      allow read, write: if staff();
    }
  }
}
```

### 2-3. 드라이브 스크립트 — API 키 대신 sgceo 계정 권한으로
규칙을 잠그면 드라이브 스크립트(`SG_CRM_Drive.gs`)의 Firestore 읽기·쓰기(API 키 방식)가 막힌다. 바꾸는 법:
- 스크립트가 **sgceo 계정의 OAuth 토큰**(`ScriptApp.getOAuthToken()`)을 `Authorization: Bearer`로 보낸다.
- 구글 계정 토큰으로 오는 요청은 보안 규칙이 아니라 **IAM 권한**으로 판단한다. sgceo가 프로젝트 `sg-crm-f9adc`의 소유자(또는 「Cloud Datastore 사용자」)이면 그대로 동작한다.
- `appsscript.json`(편집기 설정 → 「appsscript.json 표시」)에 범위를 적는다:
  `https://www.googleapis.com/auth/datastore`, `…/drive`, `…/documents`, `…/calendar`, `…/tasks`, `…/script.external_request`, `…/script.scriptapp`
- 비밀 문구(DRIVE_KEY)는 그대로 둔다(CRM → 스크립트 호출 보호용).

### 2-4. 잠그기 전에 함께 바꿔야 하는 것
| 쓰는 곳 | 지금 방식 | 잠근 뒤 |
|---|---|---|
| CRM 화면 | 로그인 없음 | 구글 로그인 추가(코드 작업) |
| 드라이브 스크립트 | API 키 | sgceo OAuth 토큰(v6) |
| **iso-one** (`ims-project`) | `iso_audits`에 씀 — 방식 확인 필요 | 같은 구글 로그인 또는 서비스 계정. **iso-one 쪽 작업** |
| 에이전트·다른 앱 읽기 (`COMPANY_MASTER.md` §3 REST) | API 키 | 서비스 계정 또는 OAuth |
| 채팅(sg-todo) | 캘린더 경유 | 영향 없음 |

## 3. 순서 (제안)
1. 사장님: Firebase 콘솔에서 Google 로그인 켜기, 현재 규칙 캡처(되돌리기용).
2. CRM 로그인 화면 + 드라이브 스크립트 v6(OAuth) 만들기 → 잠그기 **전에** 둘 다 배포해 동작 확인.
3. iso-one 쓰기 방식 확인·변경(그쪽 개발 창).
4. 콘솔 「규칙 플레이그라운드」로 시험 → 규칙 게시.
5. 문제가 생기면 1에서 캡처한 옛 규칙으로 바로 되돌린다.

## 4. 덜 확실한 임시 방편 (참고)
- API 키에 HTTP 리퍼러 제한: 키 없이도 읽히므로 **효과 없음**.
- `companies`만 읽기 전용으로: 쓰기 사고는 막지만 정보 노출은 그대로.
