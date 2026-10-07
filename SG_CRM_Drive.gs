/**
 * SG CRM 드라이브 연결 — 업체 폴더·업체카드·사업자등록증 읽기 + 음성 「할일」 자동 옮기기 (v6, 2026-10)
 *
 * 하는 일: 드라이브 「관리 업체 List」의 업체 폴더 목록과 업체카드 내용을 CRM 기업등록 화면에 넘겨준다.
 *         드라이브는 읽기만 한다(파일·폴더를 만들거나 고치거나 지우지 않는다).
 *         예외(v5): 「할일」 표시 캘린더 일정은 CRM 할 일로 옮긴 뒤 캘린더에서 지운다.
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
 * v5 추가 — 음성 「할일」 일정 → CRM 할 일 자동 옮기기 (action=voice_move + 10분 트리거):
 *   제미나이 음성으로 sgceo 기본 캘린더에 넣은 일정 중 제목에 「할일」(또는 「할 일」)이 든 것을
 *   CRM 할 일(todos)로 저장하고, 저장이 확인되면 **캘린더에서 그 일정을 지운다**(구글 캘린더 휴지통에서 복구 가능).
 *   기업명이 제목에 있으면 CRM 기업과 자동 연결. CRM이 보낸 일정([ToDo] 등)과 반복 일정은 건드리지 않는다.
 *   CRM 할 일 화면을 열 때도 한 번 돌린다(10분을 기다리지 않게).
 *   v5.1: 제미나이에 「할 일」이라고 말하면 캘린더가 아니라 **구글 Tasks**에 저장된다 → Tasks의 끝나지 않은 할 일도
 *         전부 CRM 할 일로 옮기고 Tasks에서 지운다. ⚠️ 왼쪽 「서비스 +」에서 **Tasks API**(식별자 Tasks) 추가 필요.
 *         (하위 할 일이 달린 할 일·하위 할 일은 건너뜀)
 *   v5.4: 일정 설명(Tasks 메모)에 「Claude 채팅에서 등록 (작성: 이름)」이 있으면 source='chat', createdBy=이름.
 *   v5.3: action=cal_list — CRM 일정관리에 sgceo 기본 캘린더 일정을 보여 준다(읽기만).
 *         예전 캘린더 스크립트(「SG솔루션 CRM」)의 목록 기능을 대신한다. 그 스크립트의 위치를 찾지 못해 여기로 옮김.
 *   v5.2: 실행 로그를 console.log로(편집기 「실행 로그」 창에 확실히 보이게), voiceDiag 오류도 로그로.
 *   설치(1회): 코드 교체 → 저장 → 함수 선택에서 **setupVoiceTrigger** 실행 → 권한 허용(캘린더·외부 요청)
 *             → 「배포 관리」에서 기존 배포를 **새 버전**으로 수정.
 *
 * v6 (2026-10-07) — Firestore를 공개 API 키가 아니라 **이 스크립트를 실행하는 계정(sgceo)의 권한**으로 읽고 쓴다.
 *   CRM에 로그인을 붙이고 Firestore 규칙을 잠그면 API 키 방식은 막힌다(SECURITY_PLAN.md). 계정 토큰 요청은 규칙이 아니라
 *   Google Cloud 권한(IAM)으로 판단하므로, sgceo가 프로젝트 sg-crm-f9adc의 소유자·편집자이면 잠근 뒤에도 그대로 동작한다.
 *   설치(1회):
 *    ① 편집기 왼쪽 톱니바퀴(프로젝트 설정) → 「편집기에서 "appsscript.json" 매니페스트 파일 표시」 체크
 *    ② 왼쪽 파일 목록의 appsscript.json을 열어, 맨 바깥 { } 안에 아래 "oauthScopes" 항목을 **추가**한다
 *       (다른 항목 — timeZone, dependencies, webapp 등 — 은 지우지 말 것. 앞 항목 끝에 쉼표 하나 필요)
 *         "oauthScopes": [
 *           "https://www.googleapis.com/auth/datastore",
 *           "https://www.googleapis.com/auth/drive",
 *           "https://www.googleapis.com/auth/documents",
 *           "https://www.googleapis.com/auth/calendar",
 *           "https://www.googleapis.com/auth/tasks",
 *           "https://www.googleapis.com/auth/script.external_request",
 *           "https://www.googleapis.com/auth/script.scriptapp",
 *           "https://www.googleapis.com/auth/userinfo.email"
 *         ]
 *    ③ Code.gs를 이 파일로 교체 → 저장 → 함수 선택에서 **fsCheck** 실행 → 권한 허용
 *       실행 로그에 「Firestore 읽기(계정 권한): HTTP 200」이 나오면 성공. 403이면 이 계정에 프로젝트 권한이 없는 것.
 *    ④ 「배포 관리」에서 기존 배포를 **새 버전**으로 수정
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
    if(p.action==="voice_move")return jsonOut({ok:true,data:moveVoiceTodos()});
    if(p.action==="cal_list")return jsonOut({ok:true,events:calList(p.from,p.to)});
    return jsonOut({ok:true,message:"SG CRM 드라이브 연결 정상 v5.4"});
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

// ── v5: 음성 「할일」 일정 → CRM 할 일로 옮기기 (옮긴 뒤 캘린더 일정은 삭제) ──
// CRM이 캘린더로 보내는 일정 제목 (캘린더 연동 스크립트 CRM_TITLE_RE와 같게 유지)
var CRM_TITLE_RE=/^\[(인증만료|인증완료|연간신고|지원사업|ToDo|ISO심사)\]/;
var VOICE_MARK_RE=/할\s*일/;
var TZ="Asia/Seoul";
var FS_PROJECT="sg-crm-f9adc";
var FS_BASE="https://firestore.googleapis.com/v1/projects/"+FS_PROJECT+"/databases/(default)/documents/";
// v6: Firestore 요청은 전부 여기로 — 실행 계정(sgceo)의 OAuth 토큰을 붙인다 (예전: 공개 API 키 &key=)
function fsFetch(url,opt){
  opt=opt||{};
  opt.headers=Object.assign({},opt.headers||{},{Authorization:"Bearer "+ScriptApp.getOAuthToken()});
  return UrlFetchApp.fetch(url,opt);
}
function fmtD(d){return Utilities.formatDate(d,TZ,"yyyy-MM-dd");}
// v5.4: 채팅(Claude sg-todo 스킬)이 만든 일정은 설명에 「Claude 채팅에서 등록 (작성: 이름)」이 들어 있다
//   → source 'chat', createdBy = 그 이름. 나머지 설명 줄은 메모로.
var CHAT_MARK="Claude 채팅에서 등록";
function chatInfo(desc){
  var d=String(desc||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim();
  if(d.indexOf(CHAT_MARK)<0)return {chat:false,author:"",note:d};
  var m=d.match(/작성\s*[:：]\s*([^)\n]+)/);
  var author=m?m[1].trim():"";
  var note=d.replace(/Claude 채팅에서 등록\s*(\([^)]*\))?/,"").trim();
  return {chat:true,author:author,note:note};
}
function cleanVoiceTitle(t){
  var c=String(t||"").replace(/\[?\s*할\s*일\s*\]?\s*[:：\-]?\s*/," ").replace(/\s{2,}/g," ").trim();
  return c||String(t||"");
}
// 기업명 짝짓기 — CRM normCompName·compNameKeys와 같은 규칙
function normCompName(n){
  return String(n||"").replace(/주식회사|유한회사|농업회사법인|영농조합법인|\(주\)|㈜|\(유\)|\(사\)|\s|[()·.,\-_]/g,"").toLowerCase();
}
function compNameKeys(n){
  n=String(n||"");
  var keys=[normCompName(n.replace(/\((?!주\)|유\))[^)]*\)/g,""))];
  var inner=n.match(/\((?!주\)|유\))([^)]+)\)/);
  if(inner)keys.push(normCompName(inner[1]));
  keys.push(normCompName(n.replace(/[가-힣]+\(([A-Za-z0-9 &]+)\)/,"$1")));
  return keys.filter(function(k,i){return k.length>=2&&keys.indexOf(k)===i;});
}
function findCompany(text,comps){
  var nt=normCompName(text),best=null,len=0;
  comps.forEach(function(c){
    if(c.active==="N")return;
    compNameKeys(c.name).forEach(function(k){if(k.length>len&&nt.indexOf(k)>-1){best=c;len=k.length;}});
  });
  return best;
}
function listCompanies(){
  var out=[],tok="";
  do{
    var j=JSON.parse(fsFetch(FS_BASE+"companies?pageSize=300"+(tok?"&pageToken="+tok:"")).getContentText());
    (j.documents||[]).forEach(function(d){
      var f=d.fields||{};
      out.push({id:d.name.split("/").pop(),name:(f.name&&f.name.stringValue)||"",active:(f.active&&f.active.stringValue)||""});
    });
    tok=j.nextPageToken||"";
  }while(tok);
  return out;
}
// 같은 일정은 늘 같은 문서 ID → 두 번 돌아도 한 건만 생긴다 (이미 있으면 409)
function voiceDocId(evId){
  return "voice_"+Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,evId).map(function(b){return ("0"+(b&255).toString(16)).slice(-2);}).join("");
}
function writeTodo(evId,data){
  var fields={};
  Object.keys(data).forEach(function(k){
    var v=data[k];
    fields[k]=typeof v==="number"?{integerValue:String(v)}:{stringValue:String(v)};
  });
  var r=fsFetch(FS_BASE+"todos?documentId="+voiceDocId(evId),
    {method:"post",contentType:"application/json",payload:JSON.stringify({fields:fields}),muteHttpExceptions:true});
  var code=r.getResponseCode();
  if(code===200||code===409)return true;           // 409 = 전에 이미 옮김
  throw new Error("할 일 저장 실패 HTTP "+code+": "+r.getContentText().slice(0,200));
}
// 지난 30일 ~ 앞으로 180일 중 제목에 「할일」이 든 일정 → 할 일로 저장 → 저장이 확인된 것만 캘린더에서 삭제
//   반복 일정은 시리즈 전체가 지워질 수 있어 건너뛴다. 지운 일정은 구글 캘린더 휴지통에서 되살릴 수 있다.
function moveVoiceTodos(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))return {moved:0,skipped:"다른 실행 중"};
  try{
    var cal=CalendarApp.getDefaultCalendar();
    var now=new Date();
    var evs=cal.getEvents(new Date(now.getTime()-30*86400000),new Date(now.getTime()+180*86400000)).filter(function(ev){
      var t=ev.getTitle()||"";
      return t&&!CRM_TITLE_RE.test(t)&&VOICE_MARK_RE.test(t)&&!ev.isRecurringEvent();
    });
    var tasks=listGoogleTasks();
    if(!evs.length&&!tasks.length)return {moved:0,items:[]};
    var comps=listCompanies();
    var items=[];
    // ① 구글 Tasks(할 일 목록) — 제미나이에 「할 일」이라고 말하면 캘린더 일정이 아니라 여기로 저장된다
    tasks.forEach(function(x){
      var text=cleanVoiceTitle(x.task.title);
      var co=findCompany(text,comps);
      var nowMs=Date.now();
      var due=x.task.due?String(x.task.due).slice(0,10):"";
      var ci=chatInfo(x.task.notes);
      var data={text:text,status:"wait",dueDate:due,source:ci.chat?"chat":"voice",sourceRef:"task:"+x.task.id,
        memo:(ci.chat?"채팅 할 일(구글 Tasks)":"음성 할 일(구글 Tasks)")+(ci.note?" · "+ci.note:""),
        createdBy:ci.chat?ci.author:"음성",createdAt:nowMs,updatedAt:nowMs};
      if(co){data.bizno=co.id;data.companyName=co.name;}
      writeTodo("task:"+x.task.id,data);
      Tasks.Tasks.remove(x.listId,x.task.id);
      items.push((due?due+" ":"")+text+" (Tasks)");
    });
    // ② 캘린더 일정 중 제목에 「할일」이 든 것
    evs.forEach(function(ev){
      var allDay=ev.isAllDayEvent(),st=ev.getStartTime();
      var date=fmtD(st),time=allDay?"":Utilities.formatDate(st,TZ,"HH:mm"),loc=ev.getLocation()||"";
      var text=cleanVoiceTitle(ev.getTitle());
      var co=findCompany(text,comps);
      var nowMs=Date.now();
      var ci=chatInfo(ev.getDescription());
      var data={text:text,status:"wait",dueDate:date,source:ci.chat?"chat":"voice",sourceRef:ev.getId(),
        memo:(ci.chat?"채팅 일정 ":"음성 일정 ")+date+(time?" "+time:"")+(loc?" · "+loc:"")+(ci.note?" · "+ci.note:""),
        createdBy:ci.chat?ci.author:"음성",
        createdAt:nowMs,updatedAt:nowMs};
      if(co){data.bizno=co.id;data.companyName=co.name;}
      writeTodo(ev.getId(),data);
      ev.deleteEvent();
      items.push(date+(time?" "+time:"")+" "+text);
    });
    console.log("[음성 할 일] 옮김 "+items.length+"건: "+items.join(" / "));
    return {moved:items.length,items:items};
  }finally{lock.releaseLock();}
}
// 구글 Tasks의 끝나지 않은 할 일 전부 (고급 서비스 「Tasks API」를 켜야 동작, 꺼져 있으면 건너뜀)
function listGoogleTasks(){
  if(typeof Tasks==="undefined")return [];
  var out=[];
  (Tasks.Tasklists.list({maxResults:100}).items||[]).forEach(function(l){
    var tok,all=[];
    do{
      var opt={showCompleted:false,showHidden:false,maxResults:100};
      if(tok)opt.pageToken=tok;          // undefined를 넘기면 "undefined" 글자로 전송돼 오류가 날 수 있다
      var r=Tasks.Tasks.list(l.id,opt);
      (r.items||[]).forEach(function(t){all.push(t);});
      tok=r.nextPageToken;
    }while(tok);
    // 하위 할 일이 있는 할 일은 지우면 하위까지 사라지므로 옮기지 않는다
    var parents={};all.forEach(function(t){if(t.parent)parents[t.parent]=1;});
    all.forEach(function(t){if(t.title&&t.status!=="completed"&&!t.parent&&!parents[t.id])out.push({listId:l.id,task:t});});
  });
  return out;
}
// 점검용 — 옮기지 않고 무엇이 보이는지만 실행 로그에 적는다
function voiceDiag(){
  console.log("점검 시작 (v6)");
  try{ voiceDiagRun(); }catch(e){ console.error("점검 오류: "+e.message+"\n"+e.stack); }
}
function voiceDiagRun(){
  console.log("계정: "+Session.getEffectiveUser().getEmail());
  console.log("Tasks API: "+(typeof Tasks==="undefined"?"꺼져 있음(서비스 + 에서 추가)":"켜짐"));
  if(typeof Tasks!=="undefined"){
    (Tasks.Tasklists.list({maxResults:100}).items||[]).forEach(function(l){
      var r=Tasks.Tasks.list(l.id,{showCompleted:false,maxResults:100});
      console.log("목록 「"+l.title+"」: "+(r.items||[]).map(function(t){return t.title+(t.due?" ("+t.due.slice(0,10)+")":"")+(t.parent?" [하위]":"");}).join(" / "));
    });
  }
  console.log("옮길 대상(Tasks): "+listGoogleTasks().length+"건");
  var r=fsFetch(FS_BASE+"todos?pageSize=1",{muteHttpExceptions:true});
  console.log("CRM 읽기: HTTP "+r.getResponseCode());
}
// v6 설치 확인 — 계정 권한으로 Firestore를 읽어 본다(쓰지 않음)
function fsCheck(){
  console.log("계정: "+Session.getEffectiveUser().getEmail());
  var r=fsFetch(FS_BASE+"companies?pageSize=1",{muteHttpExceptions:true});
  var code=r.getResponseCode();
  console.log("Firestore 읽기(계정 권한): HTTP "+code+(code===200?" — 성공":" — "+r.getContentText().slice(0,300)));
}
function voiceTrigger(){moveVoiceTodos();}          // 10분 트리거가 부르는 함수
// 10분마다 자동 옮기기 트리거 설치 (여러 번 실행해도 하나만 남는다)
function setupVoiceTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==="voiceTrigger")ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger("voiceTrigger").timeBased().everyMinutes(10).create();
  console.log("음성 할 일 자동 옮기기 설치 완료 — 10분마다.");
  console.log("지금 한 번 실행: "+JSON.stringify(moveVoiceTodos()));
}

// ── v5.3: CRM 일정관리용 구글 일정 목록 (읽기만) ──
// from/to: 'YYYY-MM-DD' (둘 다 포함). CRM이 보낸 일정([ToDo]·[인증만료] 등)은 CRM이 직접 그리므로 뺀다.
function calList(from,to){
  var cal=CalendarApp.getDefaultCalendar();
  var s=from?new Date(from+"T00:00:00+09:00"):new Date();
  var t=to?new Date(to+"T00:00:00+09:00"):new Date(s.getTime()+62*86400000);
  if(isNaN(s.getTime())||isNaN(t.getTime()))throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
  if(t.getTime()-s.getTime()>400*86400000)throw new Error("조회 기간이 너무 깁니다");
  t=new Date(t.getTime()+86400000);          // 종료일 포함
  return cal.getEvents(s,t).filter(function(ev){
    return !CRM_TITLE_RE.test(ev.getTitle()||"");
  }).map(function(ev){
    var allDay=ev.isAllDayEvent(),st=ev.getStartTime(),en=ev.getEndTime();
    var endIncl=allDay?new Date(en.getTime()-86400000):en;   // 올데이 종료는 다음날 0시 → 하루 빼기
    if(endIncl.getTime()<st.getTime())endIncl=st;
    return {
      id:ev.getId(),title:ev.getTitle()||"(제목 없음)",allDay:allDay,
      start:fmtD(st),end:fmtD(endIncl),
      startTime:allDay?"":Utilities.formatDate(st,TZ,"HH:mm"),
      endTime:allDay?"":Utilities.formatDate(en,TZ,"HH:mm"),
      location:ev.getLocation()||""
    };
  });
}
