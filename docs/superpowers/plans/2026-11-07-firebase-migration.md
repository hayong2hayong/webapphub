# GitHub·Firebase 이전 구현 계획

> **For agentic workers:** Use executing-plans for this migration; independent implementation/review may be delegated. Steps use checkbox tracking.

**Goal:** 기존 교실 도구함 코드를 GitHub에 보관하고 Firebase에서 운영한다.
**Architecture:** 정적 dist와 기존 Web Request/Response 학교 API에 Firebase HTTPS 어댑터만 추가한다. Key는 Secret Manager에 보관한다.
**Tech Stack:** HTML/CSS/ES modules, Node22, Firebase Hosting + Functions v2.
**Spec:** ../specs/2026-11-07-firebase-migration-design.md

## 제약과 검토 초점
- 세 앱과 기존 JSON 백업 호환성 유지. 프런트 키·로그인 입력 없음.
- dist/server/index.js·숨김 파일·키 파일이 Hosting 자원에 포함되지 않아야 한다.
- Node req.originalUrl의 경로/쿼리와 응답 상태·Allow·Cache-Control·MIME을 보존한다.
- 익명 GET 허용, 기존 POST405·잘못된쿼리400·미설정503 및 정제된 오류 유지.
- minInstances0/maxInstances1은 과금 차단 수단이 아니다. 결제 계정 연결은 사용자 확인이 필요하다.

## 작업
- [x] server/firebase-adapter.mjs, server/index.mjs, server/package.json + lockfile: createSchoolHandler를 한번 만들고, secret은 요청 시 읽으며 Express/Web 경계를 변환. tests/firebase-adapter.test.mjs에서 상태·헤더·바이트·키값 전달과 예외 정제를 먼저 실패시킨 뒤 구현.
- [x] firebase.json: source server, codebase classroom-toolbox, public firebase-public, server/**·숨김·환경 파일 제외, 정확한 API rewrite 및 mjs MIME. scripts/build-firebase.mjs가 공개 자원18개만 복사하며 생성폴더를 재생성. tests/firebase-build.test.mjs와 실제 에뮬레이터에서 비공개 경로404 확인.
- [x] 사용자가 만든 공개 GitHub 저장소 hayong2hayong/webapphub에 검증한 소스47파일 업로드. 공급자 메타데이터와 생성 Worker·인증 파일 제외, 독립 소스 점검 및 GitHub 실제 목록 확인.
- [ ] Firebase 기존 계정의 전용 프로젝트 연결, 비밀 등록, Hosting/Functions 배포. 접속 권한과 비용 변경이 필요한 단계는 구체적 상태와 함께 안내.
- [ ] 전체 테스트·독립 검토·에뮬레이터/공개 HTTP/브라우저 확인, 실제 배포 운영 기록, 이전 도메인의 개인 목록 이전 방법 안내.

## 진행
시작 소스2aeb471be09822b9af762fb6ea1bb0956015bf90, baseline57/57. 콘솔 계정 및 기존3개 Spark프로젝트 확인 완료. 이 PC에는 CLI 로그인 파일이 없어 콘솔 로그인과 CLI 인증은 별개로 준비한다.

전체61/61 테스트 통과. 어댑터3개·빌드1개는 실패→구현→통과를 확인했다. 독립 검토에서 어댑터·SDK·배포 옵션의 P1/P2 없음. 에뮬레이터 실제 HTTP: 루트·세 앱·mjs200, 서버bundle·숨김metadata·환경파일·없는주소404, API쿼리400·유효하지않은날짜400·미설정503·POST405/Allow 및 no-store 정상. 로컬 에뮬레이터는 호스트Node24를 사용했고 운영 런타임은22로 지정했다.

Ruling: hosting.ignore는 배포 업로드 필터이며 에뮬레이터는 dist/server와 숨김파일을 그대로 제공했다. 혼선을 줄이고 배포 실수도 방지하도록 물리적으로 정리된 firebase-public 빌드를 추가했다. 공식 에뮬레이터가 요구하는 firebase-admin을 명시 의존성에 추가했으며 앱은 Admin 서비스나 DB를 초기화하지 않는다.

GitHub 업로드9648438, 동일소스 tree11129d5e 확인 후 현재 폴더의 main/origin을 GitHub에 연결. 기존 이력은 sites-main/firebase-migration 브랜치에 보존. 업로드된 깨끗한 복사본에서도61개 테스트·공개자원18개 빌드 통과.

Firebase CLI 계정 연결 성공. 원격 코드 입력 오류 후 공식 CLI 로컬OAuth callback으로 전환해 사용자가 Google 승인 후 자동 완료. 새 전용 프로젝트 webapphub-hayong(Project146394459502, Classroom Toolbox) 생성 및 .firebaserc 기본 대상 연결 완료. 아직 결제 계정·키 등록·실제 배포 전.
