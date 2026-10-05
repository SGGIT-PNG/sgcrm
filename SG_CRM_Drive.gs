/**
 * SG CRM 드라이브 연결 — 업체 폴더·업체카드·사업자등록증 읽기 (v2, 2026-10)
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
    return jsonOut({ok:true,message:"SG CRM 드라이브 연결 정상 v2"});
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
// 신청서·합치기 같은 묶음 파일은 뒤로 미룬다
function certScore(f){
  var n=f.getName();var s=0;
  if(n.indexOf("합치기")>-1||n.indexOf("신청서")>-1||n.indexOf("계획서")>-1)s-=100;
  if(n.indexOf("OCR")>-1)s+=5;               // 이미 글자층이 있는 PDF
  if(f.getMimeType().indexOf("pdf")>-1)s+=3;  // 사진보다 PDF가 정확
  return s;
}
function findBizCerts(folder,depth,out){
  var it=folder.searchFiles("title contains '사업자등록증' and trashed = false");
  while(it.hasNext()){var f=it.next();if(CERT_TYPES[f.getMimeType()])out.push(f);}
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
  list.sort(function(a,b){return (certScore(b)-certScore(a))||(b.getLastUpdated().getTime()-a.getLastUpdated().getTime());});
  var best=list[0];
  return {
    file:{id:best.getId(),name:best.getName(),updated:best.getLastUpdated().toISOString()},
    text:ocrText(best),
    candidates:list.slice(0,8).map(function(x){return x.getName();})
  };
}
