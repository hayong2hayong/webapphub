# GitHub·Firebase 이전 설계

사용자 승인: 코드는 GitHub, 배포는 Firebase로 이전. 기존 교실 도구함의 화면과 세 앱 기능을 유지한다. 학생은 나이스 키·로그인 없이 조회한다.

소스는 사용자가 직접 만든 공개 저장소 hayong2hayong/webapphub로 옮긴다. 사용자 선택 공개 범위를 유지하며 실제 키나 인증 파일은 업로드하지 않는다. 원본 Sites 소스와 Git 이력은 보존한다. 기존 Firebase 계정에 로그인되어 있으며 Touchline Team, FC Pilyeon, Tamgu Record 세 프로젝트는 모두 Spark임을 콘솔에서 확인했다. 다른 서비스와 비용·배포 경계를 구분하도록 같은 계정의 교실 도구함 전용 프로젝트를 사용한다. 이는 구현자의 판단이다.

선택한 구성은 Firebase Hosting + Cloud Functions의 작은 HTTP 어댑터다. 기존 순수 ES 모듈 서버를 server/ 안에 그대로 패키징하고 나이스 키는 Secret Manager의 NEIS_API_KEY에만 등록한다. 브라우저 SDK·로그인·DB는 추가하지 않는다. 정적 파일만 배포하는 구성은 현재 서버 조회 기능을 유지할 수 없고, 전체 프레임워크 도입은 필요하지 않다.

Hosting은 scripts/build-firebase.mjs가 dist에서 공개 자원만 복사한 firebase-public을 제공한다. server/**, 숨김 파일, 환경 파일을 물리적으로 제외한다. /api/school-week만 schoolWeek 함수로 재작성한다. SPA fallback은 사용하지 않는다. 함수는 Node22, asia-east1, minInstances0, maxInstances1, memory256MiB, timeout30초, 기존5분 캐시·오류 정제를 유지한다. 최대 인스턴스는 비용 상한이 아니며 배포 전 Blaze 연결이 필요하다.

현재 브라우저 개인 목록은 도메인별 저장소이므로 기존 JSON 내보내기/가져오기로 이전한다. 공개 주소를 확인한 뒤 기존 별자리 접수의 수정 방법을 확인하며 중복 등록은 하지 않는다.

완료 조건: GitHub의 실제 소스 확인, Firebase 실제 공개 주소에서 세 앱·익명 학교 API·비공개 경로 차단 확인, 키 비공개 보관, 모바일 화면 확인. 결제 연결·CLI 인증·키 재등록이 필요한 경우 먼저 작업물을 검증 가능한 상태로 완성하고 필요한 사용자 작업을 정확히 안내한다.
