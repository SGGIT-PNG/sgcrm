/**
 * SG CRM — 중복 일정 스캔 (조회 전용, 2026-07-31)
 *
 * 목적: 옛 Apps Script 프로젝트(`SG솔루션 CRM`)가 만든 `시작`/`마감` 일정과
 *       현재 프로젝트(`SG CRM 동기화`)가 만든 기간 일정이 겹쳐 있는 것을 찾아낸다.
 *
 * ⚠️ 이 파일은 **아무것도 삭제하거나 수정하지 않는다.** 읽어서 로그로 출력만 한다.
 *
 * ── 사용법 (배포 불필요) ──
 *  1. Apps Script 프로젝트 `SG CRM 동기화` 를 연다
 *  2. 파일 + → 스크립트 → 아래 내용을 통째로 붙여넣고 저장
 *  3. 상단 함수 선택 드롭다운에서  scanDupEvents  선택 → ▶ 실행
 *  4. 하단 "실행 로그"에 나온 내용을 전부 복사해서 Claude에게 전달
 *
 *  ※ 배포(deploy)는 하지 않아도 된다. 기존 함수는 건드리지 않는다.
 *  ※ 스캔이 끝나면 이 파일은 지워도 된다.
 */

// 스캔 기간 — 필요하면 여기만 바꾸면 된다
var SCAN_FROM = '2026-01-01';
var SCAN_TO   = '2027-06-30';

// upsertEvent가 붙이는 제목 접두어들
var SCAN_PREFIX_RE = /^\[(인증만료|연간신고|지원사업|ToDo)\]\s*/;

function scanDupEvents() {
  var calId = (typeof CALENDAR_ID !== 'undefined') ? CALENDAR_ID : 'primary';
  var cal = CalendarApp.getCalendarById(calId) || CalendarApp.getDefaultCalendar();

  var from = new Date(SCAN_FROM);
  var to   = new Date(SCAN_TO);
  var evs  = cal.getEvents(from, to);

  Logger.log('달력: ' + cal.getName());
  Logger.log('기간: ' + SCAN_FROM + ' ~ ' + SCAN_TO);
  Logger.log('전체 일정: ' + evs.length + '건');
  Logger.log('──────────────────────────────────────────');

  // 1) CRM이 만든 형식(제목 접두어)만 추린다
  var crm = [];
  for (var i = 0; i < evs.length; i++) {
    var t = evs[i].getTitle() || '';
    if (SCAN_PREFIX_RE.test(t)) crm.push(evs[i]);
  }
  Logger.log('CRM 형식 일정: ' + crm.length + '건');

  // 2) 제목에서 접두어와 꼬리표(시작/마감)를 떼어 "기준 이름"으로 묶는다
  var groups = {};
  for (var j = 0; j < crm.length; j++) {
    var ev = crm[j];
    var title = ev.getTitle() || '';
    var base = title.replace(SCAN_PREFIX_RE, '').replace(/\s*(시작|마감)\s*$/, '').trim();
    if (!groups[base]) groups[base] = [];
    groups[base].push(ev);
  }

  // 3) 같은 이름이 2건 이상인 것 = 중복 후보
  var dupNames = [];
  for (var name in groups) {
    if (groups[name].length > 1) dupNames.push(name);
  }
  dupNames.sort();

  Logger.log('중복 후보(같은 이름 2건 이상): ' + dupNames.length + '개 묶음');
  Logger.log('──────────────────────────────────────────');

  if (dupNames.length === 0) {
    Logger.log('중복 없음.');
    return;
  }

  // 4) 묶음별 상세 출력 — 어느 것이 옛 프로젝트 것인지 판단할 근거를 함께 찍는다
  var known = crmEventIdSetSafe();   // 현재 프로젝트가 만든 일정 ID
  for (var k = 0; k < dupNames.length; k++) {
    var nm = dupNames[k];
    var list = groups[nm];
    Logger.log('▣ ' + nm + '  (' + list.length + '건)');
    for (var m = 0; m < list.length; m++) {
      var e = list[m];
      var owned = known[e.getId()] ? '현재프로젝트' : '옛프로젝트(추정)';
      var s = e.getStartTime(), en = e.getEndTime();
      Logger.log('   - "' + e.getTitle() + '"'
        + ' | ' + fmtD(s) + ' ~ ' + fmtD(en)
        + ' | ' + (e.isAllDayEvent() ? '종일' : '시간')
        + ' | ' + owned
        + ' | id=' + e.getId());
    }
    Logger.log('');
  }

  Logger.log('──────────────────────────────────────────');
  Logger.log('※ 이 스크립트는 아무것도 삭제하지 않았습니다.');
  Logger.log('※ 위 내용을 전부 복사해서 전달해 주세요.');
}

// 현재 프로젝트가 ScriptProperties에 기억하고 있는 일정 ID 집합
// (기존 crmEventIdSet 이 있으면 그대로 쓰고, 없으면 직접 읽는다)
function crmEventIdSetSafe() {
  try {
    if (typeof crmEventIdSet === 'function') {
      var r = crmEventIdSet();
      if (r && typeof r === 'object') return r;
    }
  } catch (err) { /* 아래 기본 경로로 진행 */ }

  var set = {};
  var props = PropertiesService.getScriptProperties().getProperties();
  for (var key in props) {
    if (key.indexOf('sgcrm_') === 0) set[props[key]] = true;
  }
  return set;
}

function fmtD(d) {
  if (!d) return '?';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}
