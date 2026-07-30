/**
 * ★ 최소 패치 — 기존 Apps Script 코드에 "덧붙이기"용 ★
 *
 * 목적: 구글 캘린더 → 앱 방향(읽기)만 추가합니다.
 *       기존 doPost / upsertEvent / deleteEvent 등 잘 돌아가는 부분은 건드리지 않습니다.
 *
 * ── 적용 방법 ────────────────────────────────────────────────
 *  1) Apps Script 편집기(SG CRM 동기화)를 엽니다.
 *  2) 기존 코드에 이미 있는 function doGet(e){...} 를 찾아 "통째로 삭제"합니다.
 *     (없으면 그냥 넘어가세요)
 *  3) 이 파일 내용 전체를 기존 코드 "맨 아래에 붙여넣기" 합니다.
 *  4) 저장(Ctrl+S)
 *  5) 배포 > 배포 관리 > 편집(연필) > 버전: "새 버전" > 배포
 *     ※ 이 단계를 빠뜨리면 반영되지 않습니다. 배포 URL은 그대로 유지됩니다.
 *
 * ── 주의 ────────────────────────────────────────────────────
 *  · 기존 코드에 아래 이름의 함수/변수가 이미 있으면 충돌합니다. 먼저 확인하세요.
 *      doGet, sgcrmJsonOut, sgcrmListEvents, sgcrmCrmEventIdSet, SGCRM_TITLE_RE
 *    (충돌을 피하려고 sgcrm 접두어를 붙여 두었습니다)
 *  · 배포 설정은 "액세스 권한이 있는 사용자 = 모든 사용자",
 *    "실행 = 나" 여야 앱에서 읽을 수 있습니다.
 *  · 되돌리려면: 배포 관리에서 이전 버전을 다시 배포하면 됩니다.
 * ─────────────────────────────────────────────────────────────
 */

// CRM이 자동 생성한 일정은 앱 화면에 이미 나오므로 목록에서 제외 (중복 방지)
//
// 1차 방어는 아래 sgcrmCrmEventIdSet() (스크립트가 기록해 둔 이벤트 ID) 이고,
// 이 제목 규칙은 태그가 없는 옛 일정까지 걸러내는 2차 방어입니다.
//
// 실제 제목 형식:
//   [인증만료] 업체 - ISO 9001
//   [연간신고] 업체 - 기업부설연구소 2026
//   [정책자금] 💰 혁신성장촉진자금      ← 분류명이 들어감 (고정 문자열 아님)
//   [지원사업] 🏆 IP나래프로그램
//   [지원사업] ○○사업 마감              ← 예전 버전이 남긴 것
//   [ToDo] 할일
//
// ※ 앱에서 새로 추가한 사용자 정의 분류(예: [환경컨설팅])는 이 목록에 없지만,
//   이 스크립트가 만든 일정이므로 1차 방어(이벤트 ID 태그)에서 걸러집니다.
var SGCRM_TITLE_RE = /^\[(인증만료|연간신고|ToDo|정책자금|지원사업|벤처·이노비즈|기업부설연구소|특허·지재|ISO\s*인증|일반자금조달|기타·행정)\]/;

function sgcrmJsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    var p = (e && e.parameter) || {};
    if(p.action === "list"){
      return sgcrmJsonOut({ ok:true, events: sgcrmListEvents(p.from, p.to) });
    }
    return sgcrmJsonOut({ ok:true, message:"SG CRM Calendar OK (list 지원)" });
  }catch(err){
    return sgcrmJsonOut({ ok:false, error: err.message });
  }
}

// from/to: 'YYYY-MM-DD' (양쪽 모두 포함)
function sgcrmListEvents(from, to){
  var calId = (typeof CALENDAR_ID !== "undefined") ? CALENDAR_ID : "primary";
  var cal = CalendarApp.getCalendarById(calId) || CalendarApp.getDefaultCalendar();

  var s = from ? new Date(from) : new Date();
  var t = to   ? new Date(to)   : new Date(s.getTime() + 62*24*60*60*1000);
  if(isNaN(s.getTime()) || isNaN(t.getTime())) throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
  t.setDate(t.getDate() + 1);   // 종료일도 포함되도록

  var mine = sgcrmCrmEventIdSet();
  var tz = Session.getScriptTimeZone();

  return cal.getEvents(s, t).filter(function(ev){
    if(mine[ev.getId()]) return false;                      // CRM이 만든 일정 제외
    if(SGCRM_TITLE_RE.test(ev.getTitle() || "")) return false; // 태그 유실 대비 제목으로도 제외
    return true;
  }).map(function(ev){
    var allDay = ev.isAllDayEvent();
    var st = ev.getStartTime(), en = ev.getEndTime();
    // 올데이 일정의 종료는 배타적(다음날 0시) → 하루 빼서 "포함 기준"으로
    var endIncl = allDay ? new Date(en.getTime() - 86400000) : en;
    if(endIncl.getTime() < st.getTime()) endIncl = st;
    return {
      id:        ev.getId(),
      title:     ev.getTitle() || "(제목 없음)",
      allDay:    allDay,
      start:     Utilities.formatDate(st, tz, "yyyy-MM-dd"),
      end:       Utilities.formatDate(endIncl, tz, "yyyy-MM-dd"),
      startTime: allDay ? "" : Utilities.formatDate(st, tz, "HH:mm"),
      endTime:   allDay ? "" : Utilities.formatDate(en, tz, "HH:mm"),
      location:  ev.getLocation() || ""
    };
  });
}

// 기존 코드가 저장해 둔 "CRM이 만든 일정" ID 모음 (sgcrm_로 시작하는 속성)
function sgcrmCrmEventIdSet(){
  var props = PropertiesService.getScriptProperties().getProperties();
  var set = {};
  Object.keys(props).forEach(function(k){
    if(k.indexOf("sgcrm_") === 0) set[props[k]] = true;
  });
  return set;
}
