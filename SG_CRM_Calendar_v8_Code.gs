/**
 * SG CRM Calendar Webhook v8
 *
 * 변경점(v7 → v8):
 *  - doGet에 action=list 추가: 지정 기간의 구글 캘린더 일정을 JSON으로 반환
 *    → 앱(간트 > 캘린더 뷰)에서 폰·PC로 입력한 개인 일정을 함께 표시하기 위함
 *  - CRM이 만든 일정([인증만료]/[연간신고]/[지원사업]/[ToDo])은 목록에서 제외 (중복 방지)
 *  - doPost가 FormData(multipart) 전송도 받도록 파싱 보강 (기존에는 JSON.parse 실패 가능)
 *
 * 적용법: Apps Script 편집기에서 기존 Code.gs 내용을 전부 지우고 이 코드로 교체 →
 *        저장(Ctrl+S) → "배포 > 배포 관리 > 편집(연필) > 버전: 새 버전 > 배포"로 재배포.
 *        (배포 URL은 그대로 유지됩니다.)
 *
 * ⚠️ 배포 설정: "액세스 권한이 있는 사용자" = "모든 사용자"여야 앱에서 읽을 수 있습니다.
 *    (실행 사용자는 "나"로 두세요. 그래야 사장님 캘린더를 읽습니다.)
 */
var CALENDAR_ID="primary";
var COLOR_CERT=CalendarApp.EventColor.RED;
var COLOR_ANNUAL=CalendarApp.EventColor.YELLOW;
var COLOR_CONS=CalendarApp.EventColor.BLUE;
var COLOR_TODO=CalendarApp.EventColor.GREEN;

// CRM이 자동 생성한 일정 제목 접두어 (목록 조회 시 제외용)
var CRM_TITLE_RE=/^\[(인증만료|연간신고|지원사업|ToDo)\]/;

function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try{
    // FormData(multipart)로 오면 e.parameter.data, 순수 텍스트면 e.postData.contents
    var raw='';
    if(e&&e.parameter&&e.parameter.data)raw=e.parameter.data;
    else if(e&&e.postData&&e.postData.contents)raw=e.postData.contents;
    if(!raw)return jsonOut({ok:false,error:"빈 요청"});
    var data=JSON.parse(raw);
    if(data.action==="upsert")upsertEvent(data.type,data.payload);
    else if(data.action==="delete")deleteEvent(data.type,data.payload.id);
    return jsonOut({ok:true});
  }catch(err){
    return jsonOut({ok:false,error:err.message});
  }
}

function doGet(e){
  try{
    var p=(e&&e.parameter)||{};
    if(p.action==="list"){
      return jsonOut({ok:true,events:listEvents(p.from,p.to)});
    }
    return jsonOut({ok:true,message:"SG솔루션 CRM 캘린더 연동 정상 v8"});
  }catch(err){
    return jsonOut({ok:false,error:err.message});
  }
}

// ── 구글 캘린더 → 앱: 기간 내 일정 목록 반환 ──
// from/to: 'YYYY-MM-DD' (둘 다 포함)
function listEvents(from,to){
  var cal=CalendarApp.getCalendarById(CALENDAR_ID)||CalendarApp.getDefaultCalendar();
  var s=from?new Date(from):new Date();
  var t=to?new Date(to):new Date(s.getTime()+62*24*60*60*1000);
  if(isNaN(s.getTime())||isNaN(t.getTime()))throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
  t.setDate(t.getDate()+1);                 // 종료일 포함되도록 하루 더
  var mine=crmEventIdSet();
  var tz=Session.getScriptTimeZone();
  return cal.getEvents(s,t).filter(function(ev){
    if(mine[ev.getId()])return false;                    // CRM이 만든 일정 제외
    if(CRM_TITLE_RE.test(ev.getTitle()||""))return false; // 태그 유실 대비 제목으로도 제외
    return true;
  }).map(function(ev){
    var allDay=ev.isAllDayEvent();
    var st=ev.getStartTime(),en=ev.getEndTime();
    // 올데이 일정의 종료는 배타적(다음날 0시) → 하루 빼서 "포함 기준"으로 변환
    var endIncl=allDay?new Date(en.getTime()-86400000):en;
    if(endIncl.getTime()<st.getTime())endIncl=st;
    return {
      id:ev.getId(),
      title:ev.getTitle()||"(제목 없음)",
      allDay:allDay,
      start:Utilities.formatDate(st,tz,"yyyy-MM-dd"),
      end:Utilities.formatDate(endIncl,tz,"yyyy-MM-dd"),
      startTime:allDay?"":Utilities.formatDate(st,tz,"HH:mm"),
      endTime:allDay?"":Utilities.formatDate(en,tz,"HH:mm"),
      location:ev.getLocation()||""
    };
  });
}

// CRM이 만든 이벤트 ID 집합 (ScriptProperties에 저장된 태그 기반)
function crmEventIdSet(){
  var props=PropertiesService.getScriptProperties().getProperties();
  var set={};
  Object.keys(props).forEach(function(k){
    if(k.indexOf("sgcrm_")===0)set[props[k]]=true;
  });
  return set;
}

function upsertEvent(type,p){
  var cal=CalendarApp.getCalendarById(CALENDAR_ID)||CalendarApp.getDefaultCalendar();
  var existId=findEventByTag(type,p.id);
  var title="",date,endDate=null,desc="",color,alarms=[];

  if(type==="cert"){
    title="[인증만료] "+p.companyName+" - "+p.certName;
    date=new Date(p.expDate);
    if(p.endDate)endDate=new Date(p.endDate); // 여러 날 심사: 종료일은 배타적(앱에서 시작+일수로 전달)
    desc="업체: "+p.companyName+"\n인증: "+p.certName+"\n만료일: "+p.expDate;
    color=COLOR_CERT;
    alarms=[90*24*60,30*24*60,7*24*60,1*24*60];
  }
  else if(type==="annual"){
    title="[연간신고] "+p.companyName+" - "+p.certName+" "+p.year;
    date=new Date(p.dueDate);
    desc="업체: "+p.companyName+"\n신고기한: "+p.dueDate;
    color=COLOR_ANNUAL;
    alarms=[30*24*60,7*24*60,1*24*60];
  }
  else if(type==="cons"){
    title="[지원사업] "+p.title;
    date=new Date(p.startDate||p.endDate);
    if(p.endDate){endDate=new Date(p.endDate);endDate.setDate(endDate.getDate()+1);} // 종료일 포함(올데이 end는 배타적)
    desc="사업명: "+p.title+"\n업체: "+(p.companies||"");
    color=COLOR_CONS;
    alarms=[30*24*60,7*24*60];
  }
  else if(type==="todo"){
    title="[ToDo] "+p.title;
    date=new Date(p.dueDate);
    desc=p.title;
    color=COLOR_TODO;
    alarms=[1*24*60];
  }

  if(!date||isNaN(date.getTime()))return;
  if(endDate&&(isNaN(endDate.getTime())||endDate.getTime()<=date.getTime()))endDate=null;

  var event;
  if(existId){
    event=cal.getEventById(existId);
    if(event){
      event.setTitle(title);
      if(endDate)event.setAllDayDates(date,endDate); else event.setAllDayDate(date);
      event.setDescription(desc);
      event.setColor(color);
      event.removeAllReminders();
    }else{
      existId=null;
    }
  }
  if(!existId){
    if(endDate)event=cal.createAllDayEvent(title,date,endDate,{description:desc});
    else event=cal.createAllDayEvent(title,date,{description:desc});
    event.setColor(color);
    saveEventTag(type,p.id,event.getId());
  }
  if(event&&alarms.length){alarms.forEach(function(m){event.addPopupReminder(m);});}
}

function deleteEvent(type,id){
  var eid=findEventByTag(type,id);if(!eid)return;
  var cal=CalendarApp.getCalendarById(CALENDAR_ID)||CalendarApp.getDefaultCalendar();
  var e=cal.getEventById(eid);if(e)e.deleteEvent();
  removeEventTag(type,id);
}

function tagKey(t,id){return"sgcrm_"+t+"_"+id;}
function saveEventTag(t,id,eid){PropertiesService.getScriptProperties().setProperty(tagKey(t,id),eid);}
function findEventByTag(t,id){return PropertiesService.getScriptProperties().getProperty(tagKey(t,id));}
function removeEventTag(t,id){PropertiesService.getScriptProperties().deleteProperty(tagKey(t,id));}
