/**
 * SG CRM 드라이브 연결 — 업체 폴더·업체카드·사업자등록증 읽기 + 음성 일정 받은함 + 아침 할 일 메일 (v5, 2026-10)
 *
 * 하는 일: 드라이브 「관리 업체 List」의 업체 폴더 목록과 업체카드 내용을 CRM 기업등록 화면에 넘겨준다.
 *         읽기만 한다. 드라이브의 파일·폴더를 만들거나 고치거나 지우지 않는다.
 *         캘린더 연동 스크립트(SG솔루션 CRM)와는 별개의 프로젝트다 — 캘린더 쪽은 건드리지 않는다.
 *
 * 처음 설치 (sgceo@sgsolutionss.com 계정으로):
 *  1. https://script.google.com → 「새 프로젝트」 → 이름을 「SG CRM 드라이브」로 바꾼다
 *  2. Code.gs 내용을 전부 지우고 이 파일 내용을 붙여넣기 → 저장
 *  3. 왼쪽 톱니바퀴(프로젝트 설정) → 맨 아래 「스크립트 속성 추가」
 *       속성: DRIVE_KEY   값: 사장님이 정한 비밀 문구
 *  4. 오른쪽 위 「배포」 → 「새 배포」 → 톱니바퀴에서 「웹 앱」 선택
 *       실행 사용자: 나 / 액세스 권한: 모든 사용자 → 「배포」
 *     드라이브 접근 권한 승인 창이 뜨면 허용 (「고급」 → 「(안전하지 않음)으로 이동」을 눌러야 할 수 있다)
 *  5. 나온 「웹 앱 URL」(…/exec)을 복사 → CRM 「드라이브에서 가져오기」 창의 「드라이브 연결 주소」에 붙여넣기
 *     비밀 문구도 같은 값으로 입력
 *
 * v2 추가 — 사업자등록증 읽기(action=biz_cert):
 *   업체 폴더(하위 3단계까지)에서 이름에 「사업자등록증」이 든 PDF·JPG·PNG를 찾아 구글 드라이브 OCR로 글자를 읽는다.
 *   ⚠️ 왼쪽 「서비스 +」에서 **Drive API**를 추가해야 한다(식별자 Drive). 추가 후 「새 버전」으로 재배포.
 *   OCR은 임시 구글 문서를 만들어 글자를 꺼낸 뒤 그 임시 문서를 바로 휴지통으로 보낸다. 원본 파일은 건드리지 않는다.
 *   같은 파일은 6시간 동안 결과를 기억해 다시 읽지 않는다.
 *   v4: 파일 이름이 「사업자 등록증」(띄어쓰기)·「사업자등록증명」이어도 찾는다.
 *
 * v5 추가 — 음성 일정 받은함(action=voice_inbox) + 아침 할 일 메일:
 *   ① 제미나이 음성으로 sgceo 기본 캘린더에 넣은 일정 중 제목에 「할일」(또는 「할 일」)이 든 것을 CRM 할 일 화면
 *      「📥 음성 받은함」에 보여 준다. 표시어 없는 최근 일정은 「기타 새 일정」으로 접어서 보여 준다.
 *      CRM이 캘린더로 보낸 일정([ToDo]·[인증만료] 등)은 빼고, 캘린더는 읽기만 한다.
 *   ② morningMail — 평일 아침 CRM 할 일을 읽어 놓친 일·진행 중·이번 주 마감·음성 받은함을 메일로 보낸다.
 *      보낼 것이 없는 날은 보내지 않는다(월요일은 주간 요약으로 항상 보냄).
 *   설치(1회): 코드 교체 → 저장 → 위쪽 함수 선택에서 **setupMorningMail** 실행 → 권한 허용(캘린더·메일·외부 요청)
 *             → 「배포 관리」에서 기존 배포를 **새 버전**으로 수정. 바로 받아 보려면 **testMorningMail** 실행.
 *   받는 사람: 스크립트 속성 MAIL_TO (쉼표로 여러 명). 비우면 스크립트 주인(sgceo)에게만.
 *
 * 비밀 문구를 두는 이유: CRM에는 아직 로그인이 없다. 주소만 알아서는 업체카드(사업자번호·매출 등)를
 *   읽지 못하게 한다. 주소와 비밀 문구는 Firestore가 아니라 각 기기 브라우저에만 저장된다.
 */
function jsonOut(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  try{
    var p=(e&&e.parameter)||{};
    if(!driveKeyOk(p.key))return jsonOut({ok:false,error:"드라이브 비밀 문구가 맞지 않습니다"});
    if(p.action==="drive_companies")return jsonOut({ok:true,folders:driveCompanies()});
    if(p.action==="drive_card")return jsonOut({ok:true,data:driveCard(p.folderId)});
    if(p.action==="biz_cert")return jsonOut({ok:true,data:bizCert(p.folderId)});
    if(p.action==="voice_inbox")return jsonOut({ok:true,data:voiceInbox()});
    return jsonOut({ok:true,message:"SG CRM 드라이브 연결 정상 v5"});
  }catch(err){
    return jsonOut({ok:false,error:err.message});
  }
}

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

// ── v2: 사업자등록증 찾기 + OCR ──
var CERT_TYPES={"application/pdf":1,"application/haansoftpdf":1,"image/jpeg":1,"image/png":1};
// 비교용: 법인 표기·공백·기호 제거
function normName(n){
  return String(n||"").replace(/주식회사|유한회사|농업회사법인|\(주\)|㈜|\(유\)|\s|[()·.,_-]/g,"").toLowerCase();
}
// 폴더 이름의 상호 후보 낱말 ("전주_(주)센세이션" → ["전주","센세이션"])
function folderWords(folderName){
  return String(folderName||"").split(/[_-]/).map(normName).filter(function(w){return w.length>=2&&w.indexOf("대표")<0;});
}
// 파일 고르기 점수: 폴더 업체명이 파일 이름에 있으면 우선, 신청서·합치기 같은 묶음 파일은 뒤로
//   (v3: 센세이션 폴더에 같이 있던 스탠다즈 등록증을 잘못 고른 문제 수정)
function certScore(f,words){
  var n=f.getName();var s=0;var nn=normName(n);
  if(words&&words.some(function(w){return nn.indexOf(w)>-1;}))s+=50;
  if(n.indexOf("합치기")>-1||n.indexOf("신청서")>-1||n.indexOf("계획서")>-1)s-=100;
  if(n.indexOf("OCR")>-1)s+=5;               // 이미 글자층이 있는 PDF
  if(f.getMimeType().indexOf("pdf")>-1)s+=3;  // 사진보다 PDF가 정확
  return s;
}
// v4: 「사업자 등록증」(띄어쓰기)·「사업자등록증명원」처럼 이름이 조금 다른 파일도 찾는다
function isBizCertName(n){return /사업자\s*등록/.test(n)&&!/신청서/.test(n);}
function findBizCerts(folder,depth,out){
  var it=folder.searchFiles("(title contains '등록증' or title contains '사업자등록') and trashed = false");
  while(it.hasNext()){var f=it.next();if(CERT_TYPES[f.getMimeType()]&&isBizCertName(f.getName()))out.push(f);}
  if(depth<=0)return out;
  var subs=folder.getFolders();
  while(subs.hasNext()){var sf=subs.next();if(sf.getName()==="_카드이력")continue;findBizCerts(sf,depth-1,out);}
  return out;
}
function ocrText(file){
  var cache=CacheService.getScriptCache();
  var ck="ocr_"+file.getId()+"_"+file.getLastUpdated().getTime();
  var hit=cache.get(ck);if(hit)return hit;
  var blob=file.getBlob();
  if(file.getMimeType()==="application/haansoftpdf")blob.setContentType("application/pdf");
  var docId;
  if(Drive.Files.insert){   // Drive API v2
    docId=Drive.Files.insert({title:"_sgcrm_ocr_tmp",mimeType:"application/vnd.google-apps.document"},blob,{ocr:true,ocrLanguage:"ko"}).id;
  }else{                    // Drive API v3
    docId=Drive.Files.create({name:"_sgcrm_ocr_tmp",mimeType:"application/vnd.google-apps.document"},blob,{ocrLanguage:"ko"}).id;
  }
  var text="";
  try{ text=DocumentApp.openById(docId).getBody().getText(); }
  finally{ DriveApp.getFileById(docId).setTrashed(true); }
  if(text.length<90000)cache.put(ck,text,21600);
  return text;
}
function bizCert(folderId){
  if(!folderId)throw new Error("folderId가 없습니다");
  var f=DriveApp.getFolderById(folderId);
  if(!isUnderRoot(f))throw new Error("관리 업체 List 밖의 폴더입니다");
  var list=findBizCerts(f,3,[]);
  if(!list.length)return {file:null,text:"",candidates:[]};
  var words=folderWords(f.getName());
  list.sort(function(a,b){return (certScore(b,words)-certScore(a,words))||(b.getLastUpdated().getTime()-a.getLastUpdated().getTime());});
  var best=list[0];
  return {
    file:{id:best.getId(),name:best.getName(),updated:best.getLastUpdated().toISOString()},
    text:ocrText(best),
    candidates:list.slice(0,8).map(function(x){return x.getName();})
  };
}

// ── v5: 음성 일정 받은함 ──
// CRM이 캘린더로 보내는 일정 제목 (캘린더 연동 스크립트 CRM_TITLE_RE와 같게 유지)
var CRM_TITLE_RE=/^\[(인증만료|인증완료|연간신고|지원사업|ToDo|ISO심사)\]/;
var VOICE_MARK_RE=/할\s*일/;
var TZ="Asia/Seoul";
function fmtD(d){return Utilities.formatDate(d,TZ,"yyyy-MM-dd");}
// 표시어 있는 일정: 지난 30일 ~ 앞으로 180일 / 기타: 최근 14일 안에 만든 일정
function voiceInbox(){
  var cal=CalendarApp.getDefaultCalendar();
  var now=new Date();
  var from=new Date(now.getTime()-30*86400000),to=new Date(now.getTime()+180*86400000);
  var recent=now.getTime()-14*86400000;
  var marked=[],others=[];
  cal.getEvents(from,to).forEach(function(ev){
    var t=ev.getTitle()||"";
    if(!t||CRM_TITLE_RE.test(t))return;
    var allDay=ev.isAllDayEvent();var st=ev.getStartTime();
    var o={id:ev.getId(),title:t,date:fmtD(st),time:allDay?"":Utilities.formatDate(st,TZ,"HH:mm"),
           created:ev.getDateCreated().getTime(),location:ev.getLocation()||""};
    if(VOICE_MARK_RE.test(t))marked.push(o);
    else if(o.created>=recent)others.push(o);
  });
  return {marked:marked,others:others.slice(0,60)};
}

// ── v5: 아침 할 일 메일 ──
var FS_PROJECT="sg-crm-f9adc";
var FS_KEY="AIzaSyD7EoihxcX9zIbr1n4NiXK_qlWpv8p5gRk";   // CRM index.html과 같은 웹 API 키(공개값)
var CRM_URL="https://sggit-png.github.io/sgcrm/";
function fsVal(v){
  if(!v)return null;
  if("stringValue" in v)return v.stringValue;
  if("integerValue" in v)return Number(v.integerValue);
  if("doubleValue" in v)return v.doubleValue;
  if("booleanValue" in v)return v.booleanValue;
  if("nullValue" in v)return null;
  if("timestampValue" in v)return v.timestampValue;
  if("arrayValue" in v)return (v.arrayValue.values||[]).map(fsVal);
  if("mapValue" in v){var o={},f=v.mapValue.fields||{};for(var k in f)o[k]=fsVal(f[k]);return o;}
  return null;
}
function fsList(col){
  var out=[],tok="";
  do{
    var url="https://firestore.googleapis.com/v1/projects/"+FS_PROJECT+"/databases/(default)/documents/"+col+"?pageSize=300&key="+FS_KEY+(tok?"&pageToken="+tok:"");
    var j=JSON.parse(UrlFetchApp.fetch(url).getContentText());
    (j.documents||[]).forEach(function(d){var o=fsVal({mapValue:{fields:d.fields||{}}});o._id=d.name.split("/").pop();out.push(o);});
    tok=j.nextPageToken||"";
  }while(tok);
  return out;
}
function fsGet(path){
  var r=UrlFetchApp.fetch("https://firestore.googleapis.com/v1/projects/"+FS_PROJECT+"/databases/(default)/documents/"+path+"?key="+FS_KEY,{muteHttpExceptions:true});
  if(r.getResponseCode()!==200)return {};
  return fsVal({mapValue:{fields:JSON.parse(r.getContentText()).fields||{}}});
}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}
// CRM todoBucket()과 같은 규칙
function bucketOf(t,today,R){
  if(t.status==="done")return {col:"done"};
  var due=t.dueDate||"",dl=due?daysBetween(today,due):null;
  if(due&&dl<0)return {col:"miss",reason:"마감 "+(-dl)+"일 지남"};
  var touched=t.statusAt||t.createdAt||0;
  var idle=touched?Math.floor((Date.now()-touched)/86400000):0;
  if(t.status==="ing"&&touched&&idle>=R.stallDays)return {col:"miss",reason:idle+"일째 그대로"};
  if(t.status!=="ing"&&due&&dl<=R.soonDays)return {col:"miss",reason:"D-"+dl+" · 아직 시작 안 함"};
  if(t.status==="ing")return {col:"ing",idle:idle,dl:dl};
  return {col:due&&dl>R.horizonDays?"later":"todo",dl:dl};
}
function buildMorning(){
  var today=fmtD(new Date());
  var cfg=fsGet("app_state/config");
  var R={stallDays:14,soonDays:3,horizonDays:30,leadDays:14};
  if(cfg.todoRules)for(var k in R)if(typeof cfg.todoRules[k]==="number")R[k]=cfg.todoRules[k];
  var todos=fsList("todos"),comps=fsList("companies");
  var miss=[],ing=[],week=[],noDue=[];
  todos.forEach(function(t){
    var b=bucketOf(t,today,R);
    if(b.col==="miss")miss.push({t:t,r:b.reason});
    else if(b.col==="ing")ing.push({t:t,idle:b.idle});
    if(b.col!=="done"&&t.dueDate&&b.col!=="miss"&&daysBetween(today,t.dueDate)<=7)week.push(t);
    if(b.col!=="done"&&!t.dueDate)noDue.push(t);
  });
  // 잠재고객 후속 (CRM todoLeadItems와 같은 규칙)
  comps.forEach(function(c){
    if(c.group!=="잠재고객"||c.active==="N")return;
    var mine=todos.filter(function(t){return t.bizno===c._id;});
    if(mine.some(function(t){return t.status!=="done";}))return;
    var last=c.lastContactAt||0;
    mine.forEach(function(t){last=Math.max(last,t.doneAt||0,t.updatedAt||0,t.createdAt||0);});
    if(!last)last=c.createdAt||0;
    if(!last)return;
    var d=Math.floor((Date.now()-last)/86400000);
    if(d>=R.leadDays)miss.push({t:{text:"["+c.name+"] 후속 연락"},r:"잠재고객 · 마지막 기록 "+d+"일 전"});
  });
  ing.sort(function(a,b){return b.idle-a.idle;});
  week.sort(function(a,b){return a.dueDate<b.dueDate?-1:1;});
  // 음성 받은함: 표시어 일정 중 아직 할 일로 안 옮기고 무시하지도 않은 것
  var taken={};todos.forEach(function(t){if(t.source==="voice"&&t.sourceRef)taken[t.sourceRef]=1;});
  (cfg.voiceDismissed||[]).forEach(function(id){taken[id]=1;});
  var voice=voiceInbox().marked.filter(function(e){return !taken[e.id];});
  return {today:today,miss:miss,ing:ing,week:week,noDue:noDue,voice:voice};
}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function morningHtml(m){
  var sec=function(title,color,rows){
    return '<h3 style="margin:18px 0 6px;font-size:15px;color:'+color+'">'+title+'</h3>'
      +(rows.length?'<ul style="margin:0;padding-left:18px;line-height:1.7">'+rows.join("")+'</ul>':'<div style="color:#888;font-size:13px">없음</div>');
  };
  // 글에 이미 기업명이 있으면 [기업]을 앞에 또 붙이지 않는다
  var lab=function(t){
    var x=t.text||"",short=String(t.companyName||"").replace(/주식회사|\(주\)|㈜/g,"").trim();
    return esc(x.charAt(0)==="["||!short||x.indexOf(short)>-1?x:"["+short+"] "+x);
  };
  var h='<div style="font-family:sans-serif;font-size:14px;color:#222;max-width:640px">';
  h+=sec("🔴 놓치고 있는 일 ("+m.miss.length+")","#DC2626",m.miss.map(function(x){return "<li>"+lab(x.t)+' — <b style="color:#DC2626">'+esc(x.r)+"</b></li>";}));
  h+=sec("🟡 지금 하는 일 ("+m.ing.length+") — 손댄 지 오래된 순","#D97706",m.ing.map(function(x){return "<li>"+lab(x.t)+" — "+x.idle+"일째"+(x.t.dueDate?" · 마감 "+x.t.dueDate:"")+"</li>";}));
  h+=sec("🔵 7일 안 마감 ("+m.week.length+")","#2563EB",m.week.map(function(t){return "<li>"+t.dueDate+" "+lab(t)+"</li>";}));
  if(m.voice.length)h+=sec("📥 음성으로 들어온 일정 ("+m.voice.length+") — CRM 할 일 화면에서 옮길지 확인","#7C3AED",m.voice.map(function(e){return "<li>"+e.date+(e.time?" "+e.time:"")+" "+esc(e.title)+"</li>";}));
  if(m.noDue.length)h+=sec("⚠️ 마감일 없는 할 일 ("+m.noDue.length+") — 날짜를 넣어야 놓친 일 판단이 됩니다","#64748B",m.noDue.slice(0,10).map(function(t){return "<li>"+lab(t)+"</li>";}));
  h+='<p style="margin-top:20px"><a href="'+CRM_URL+'" style="background:#2563EB;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">CRM 할 일 열기</a></p>';
  h+='<p style="color:#999;font-size:12px">SG CRM 드라이브 스크립트가 평일 아침 자동으로 보냅니다. 받는 사람은 스크립트 속성 MAIL_TO로 바꿉니다.</p></div>';
  return h;
}
function morningRecipients(){
  var p=PropertiesService.getScriptProperties().getProperty("MAIL_TO");
  return (p&&p.trim())||Session.getEffectiveUser().getEmail();
}
function sendMorning(force){
  var dow=Number(Utilities.formatDate(new Date(),TZ,"u"));   // 1=월 … 7=일
  if(!force&&dow>=6)return "주말 — 보내지 않음";
  var m=buildMorning();
  var monday=dow===1;
  if(!force&&!monday&&!m.miss.length&&!m.week.length&&!m.voice.length)return "보낼 것 없음 — 보내지 않음";
  var md=Utilities.formatDate(new Date(),TZ,"M/d");
  var wd=["","월","화","수","목","금","토","일"][dow];
  var subj="[SG 할 일] "+md+"("+wd+") 놓친 일 "+m.miss.length+" · 진행 "+m.ing.length+" · 7일 안 마감 "+m.week.length+(m.voice.length?" · 음성 "+m.voice.length:"")+(monday?" — 주간 요약":"");
  MailApp.sendEmail({to:morningRecipients(),subject:subj,htmlBody:morningHtml(m),name:"SG CRM 비서"});
  return "보냄: "+subj;
}
function morningMail(){Logger.log(sendMorning(false));}       // 트리거가 부르는 함수
function testMorningMail(){Logger.log(sendMorning(true));}    // 지금 바로 한 통 받아 보기
// 평일 아침 8시 트리거 설치 (여러 번 실행해도 하나만 남는다)
function setupMorningMail(){
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==="morningMail")ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("morningMail").timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  Logger.log("아침 메일 트리거 설치 완료 — 매일 8시(주말은 건너뜀), 받는 사람: "+morningRecipients());
}
