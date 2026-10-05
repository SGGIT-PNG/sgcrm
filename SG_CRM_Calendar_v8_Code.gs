/**
 * SG CRM Calendar Webhook v11
 *
 * 변경점(v10 → v11):
 *  - doGet에 action=drive_companies / drive_card 추가: 드라이브 「관리 업체 List」의 업체 폴더·업체카드를
 *    CRM 기업등록 화면에 넘겨준다(읽기 전용). 함수 본체는 이 파일 맨 아래.
 *    처음 배포할 때 "드라이브 접근 권한" 승인 창이 뜬다 → 허용.
 *    스크립트 속성 DRIVE_KEY(비밀 문구)가 맞아야만 응답한다.
 *
 * 변경점(v9 → v10):
 *  - type="isocert" 추가: ISO 인증완료(발급일) 마커를 iso-one에서 받아 표시(초록, 알림 없음).
 *    → 이제 기업당 [ISO심사](차기심사·미래) + [인증완료](발급일·과거) 2건.
 *  - CRM_TITLE_RE에 인증완료 추가.
 *
 * 변경점(v8 → v9):
 *  - type="iso" 추가: ISO 인증 심사 일정을 iso-one(발급일 기준)에서 받아 표시.
 *    → CRM 수기 인증([인증만료])은 더 이상 ISO를 만들지 않고, iso-one의 정확한
 *       "차기심사 예정일([ISO심사])"만 캘린더에 뜬다(D-90/30/7 알림).
 *  - CRM_TITLE_RE에 ISO심사 추가(목록 중복 방지), 색상 COLOR_ISO(보라).
 *
 * 변경점(v7 → v8):
 *  - doGet에 action=list 추가: 지정 기간의 구글 캘린더 일정을 JSON으로 반환
 *  - CRM이 만든 일정은 목록에서 제외 (중복 방지)
 *  - doPost가 FormData(multipart) 전송도 받도록 파싱 보강
 *
 * 적용법: Apps Script 편집기에서 기존 Code.gs 내용을 전부 지우고 이 코드로 교체 →
 *        저장(Ctrl+S) → "배포 > 배포 관리 > 편집(연필) > 버전: 새 버전 > 배포"로 재배포.
 *        (배포 URL은 그대로 유지됩니다.)
 *        v11부터: 재배포 전에 「프로젝트 설정(톱니바퀴) → 스크립트 속성 → 속성 추가」에서
 *        DRIVE_KEY = 사장님이 정한 비밀 문구 를 넣는다 (CRM 「드라이브에서 가져오기」 창에 같은 값 입력).
 *
 * ⚠️ 배포 설정: "액세스 권한이 있는 사용자" = "모든 사용자"여야 앱에서 읽을 수 있습니다.
 *    (실행 사용자는 "나"로 두세요. 그래야 사장님 캘린더를 읽습니다.)
 */
var CALENDAR_ID="primary";
var COLOR_CERT=CalendarApp.EventColor.RED;
var COLOR_ANNUAL=CalendarApp.EventColor.YELLOW;
var COLOR_CONS=CalendarApp.EventColor.BLUE;
var COLOR_TODO=CalendarApp.EventColor.GREEN;
var COLOR_ISO=CalendarApp.EventColor.MAUVE;      // ISO 차기심사(iso-one 연동) — 보라
var COLOR_ISOCERT=CalendarApp.EventColor.PALE_GREEN;  // ISO 인증완료(발급일) — 초록

// CRM이 자동 생성한 일정 제목 접두어 (목록 조회 시 제외용)
var CRM_TITLE_RE=/^\[(인증만료|인증완료|연간신고|지원사업|ToDo|ISO심사)\]/;

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
    // v11: 드라이브 업체 폴더 읽기 (함수는 이 파일 맨 아래)
    if(p.action==="drive_companies"||p.action==="drive_card"){
      if(!driveKeyOk(p.key))return jsonOut({ok:false,error:"드라이브 비밀 문구가 맞지 않습니다"});
      if(p.action==="drive_companies")return jsonOut({ok:true,folders:driveCompanies()});
      return jsonOut({ok:true,data:driveCard(p.folderId)});
    }
    return jsonOut({ok:true,message:"SG솔루션 CRM 캘린더 연동 정상 v11"});
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
    desc="기업: "+p.companyName+"\n인증: "+p.certName+"\n만료일: "+p.expDate;
    color=COLOR_CERT;
    alarms=[90*24*60,30*24*60,7*24*60,1*24*60];
  }
  else if(type==="annual"){
    title="[연간신고] "+p.companyName+" - "+p.certName+" "+p.year;
    date=new Date(p.dueDate);
    desc="기업: "+p.companyName+"\n신고기한: "+p.dueDate;
    color=COLOR_ANNUAL;
    alarms=[30*24*60,7*24*60,1*24*60];
  }
  else if(type==="cons"){
    title="[지원사업] "+p.title;
    date=new Date(p.startDate||p.endDate);
    if(p.endDate){endDate=new Date(p.endDate);endDate.setDate(endDate.getDate()+1);} // 종료일 포함(올데이 end는 배타적)
    desc="사업명: "+p.title+"\n기업: "+(p.companies||"");
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
  else if(type==="iso"){
    // ISO 인증 차기심사 예정(iso-one 발급일 기준). certName 예: "ISO 9001·14001 사후심사(1차)"
    title="[ISO심사] "+p.companyName+" - "+p.certName;
    date=new Date(p.dueDate);
    desc="기업: "+p.companyName+"\n차기심사: "+(p.certName||"")+"\n예정일: "+p.dueDate
        +(p.issueDate?("\n인증발급일: "+p.issueDate):"")+"\n(출처: iso-one)";
    color=COLOR_ISO;
    alarms=[90*24*60,30*24*60,7*24*60];
  }
  else if(type==="isocert"){
    // ISO 인증완료(발급일) 마커 — 과거 날짜라 알림 없음. certName 예: "ISO 9001·14001"
    title="[인증완료] "+p.companyName+" - "+p.certName;
    date=new Date(p.issueDate);
    desc="기업: "+p.companyName+"\n인증완료(발급일): "+p.issueDate+"\n(출처: iso-one)";
    color=COLOR_ISOCERT;
    alarms=[];
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

// ── 드라이브 → CRM: 업체 폴더·업체카드 읽기 (v11, 기업등록용, 읽기 전용) ──
// 스크립트 속성 DRIVE_KEY(비밀 문구)가 맞아야만 응답한다. Firestore에는 저장하지 않는 값.
var DRIVE_ROOT_ID="1r56aiSxuFYoR-XR72e_XyvETVqfJxTaX";  // 관리 업체 List

function driveKeyOk(k){
  var s=PropertiesService.getScriptProperties().getProperty("DRIVE_KEY");
  return !!s&&!!k&&k===s;
}

// "8. 경기도" 처럼 숫자+점으로 시작하는 시도 폴더만
function isSidoName(n){
  var dot=n.indexOf(".");
  return dot>0&&!isNaN(Number(n.slice(0,dot)));
}

// 이력 카드: <번호>_업체카드_<업체명>_YYMMDD-HHMM.md
function isHistoryCard(nm){
  var base=nm.slice(-3)===".md"?nm.slice(0,-3):nm;
  var t=base.slice(-12);
  return t.charAt(0)==="_"&&t.charAt(7)==="-"&&!isNaN(Number(t.slice(1,7)))&&!isNaN(Number(t.slice(8)));
}

// 업체 폴더 목록 + 업체카드 위치
function driveCompanies(){
  var root=DriveApp.getFolderById(DRIVE_ROOT_ID);
  var out=[];
  var sidos=root.getFolders();
  while(sidos.hasNext()){
    var sd=sidos.next();var sn=sd.getName();
    if(!isSidoName(sn))continue;
    var fs=sd.getFolders();
    while(fs.hasNext()){
      var f=fs.next();
      out.push({id:f.getId(),name:f.getName(),sido:sn,updated:f.getLastUpdated().toISOString()});
    }
  }
  // 카드는 업체 폴더 바로 안, 또는 그 안의 「업체카드」 폴더에 있다
  var cards={};
  var it=DriveApp.searchFiles("title contains '_업체카드_' and trashed = false");
  while(it.hasNext()){
    var c=it.next();var nm=c.getName();
    if(isHistoryCard(nm))continue;
    var ps=c.getParents();
    while(ps.hasNext()){
      var p=ps.next();var fid=p.getId();
      if(p.getName()==="업체카드"){var pp=p.getParents();if(pp.hasNext())fid=pp.next().getId();}
      cards[fid]={id:c.getId(),name:nm};
    }
  }
  out.forEach(function(o){var c=cards[o.id];if(c){o.cardId=c.id;o.cardName=c.name;}});
  return out;
}

function findCardIn(folder){
  var it=folder.searchFiles("title contains '_업체카드_' and trashed = false");
  while(it.hasNext()){var c=it.next();if(!isHistoryCard(c.getName()))return c;}
  return null;
}

// 업체 폴더가 관리 업체 List 아래에 있는지 (다른 폴더를 읽지 못하게)
function isUnderRoot(f){
  for(var i=0;i<4;i++){
    var ps=f.getParents();
    if(!ps.hasNext())return false;
    f=ps.next();
    if(f.getId()===DRIVE_ROOT_ID)return true;
  }
  return false;
}

// 업체 폴더 하나: 업체카드 본문 + 「1.기본공통서류」 파일 이름
function driveCard(folderId){
  if(!folderId)throw new Error("folderId가 없습니다");
  var f=DriveApp.getFolderById(folderId);
  if(!isUnderRoot(f))throw new Error("관리 업체 List 밖의 폴더입니다");
  var card=findCardIn(f);
  if(!card){var sub=f.getFoldersByName("업체카드");if(sub.hasNext())card=findCardIn(sub.next());}
  var docs=[];
  var b=f.getFoldersByName("1.기본공통서류");
  if(b.hasNext()){
    var fi=b.next().getFiles();
    while(fi.hasNext()&&docs.length<50){var x=fi.next();docs.push(x.getName());}
  }
  return {
    folder:{id:f.getId(),name:f.getName(),url:f.getUrl()},
    card:card?{id:card.getId(),name:card.getName(),text:card.getBlob().getDataAsString("UTF-8")}:null,
    basicDocs:docs
  };
}
