/**
 * SG CRM 드라이브 연결 — 업체 폴더·업체카드 읽기 전용 (v1, 2026-10)
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
    return jsonOut({ok:true,message:"SG CRM 드라이브 연결 정상 v1"});
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
