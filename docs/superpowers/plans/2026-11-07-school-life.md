# 공용 급식·시간표 구현 계획

> **역사 기록 · 폐기됨 (2026-11-07):** 급식·시간표 앱과 외부 API·백엔드 연결을 제거했다. 아래 완료 표시는 제거 전 이력이며 현재 작업 지시가 아니다. 비밀 등록·서버 빌드·배포 절차를 다시 실행하지 않는다. 현재 범위는 [개발명세서](../../SPEC.md)를 따른다.

Spec: ../specs/2026-11-07-school-life-design.md
목표: 학생이 키 없이 보는 한솔고2학년8반 급식·시간표를 기존 허브에 통합.

## 작업·파일
- [x] API: server/school-api.mjs + tests/school-api.test.mjs. 공식 NEIS 서버 조회·필터·정규화·캐시·오류. 무의존성 ES 모듈이며 빌드에 그대로 포함. createSchoolHandler({fetcher,now,cache}={}) -> handler(request,env,ctx). env.NEIS_API_KEY만 키 사용.
- [x] UI: dist/apps/school-life/index.html, school-life.css, school-life.mjs, school-core.mjs + tests/school-ui.test.mjs. 기존 CSS/UI도우미 활용, 학생 설정 키필드 없음, 상태·이전응답 경합 제어, 날짜·주간표·메뉴.
- [x] 런타임: scripts/build-worker.mjs가 dist의 공개 자원만 자가완결 Worker dist/server/index.js에 포함. .env.local 및 문서는 포함하지 않음. Worker manifest에서 static 제거. build/로컬서버/검증·기존앱 통합은 주 에이전트 소유.
- [x] 비밀 등록: 사용자 저장 완료 응답 후 .env.local을 출력 없이 읽어 Sites secret 등록. 실제 키 샘플이 아닌 전체 조회 검증 후 로컬 원문 삭제. 공유·비밀 전달에 대한 사용자의 지시 범위에서 수행.
- [x] 핵심·보안·브라우저·구버전 테스트, 독립 리뷰, source helper 커밋/패키지/배포, 익명 HTTP·실제화면 확인. 별자리 재등록 없음.

## API 계약
요청: `/api/school-week?date=2026-11-07`, date 생략 시 오늘 KST.
정상 응답: `{school:{name,educationCode,schoolCode},grade:2,className:"8",week:{start,end,dates:[7개ISO날짜]},updatedAt,meals:{status:"ok"|"empty"|"error",message?,rows:[{date,typeCode,typeName,dishes:[문자열],calories}]},timetable:{status:"ok"|"empty"|"error",message?,rows:[{date,period,subject,classroom,course,department}]}}`.
부분 오류는200에서 각패널status:error. 전역 오류는 `{error:{code,message}}`, missing key503/NOT_CONFIGURED, 입력400, 허용안된메서드405. 서버 원본 오류·키는 응답하지 않음.
학교固定: name 한솔고등학교, educationCode I10, schoolCode9300058. 공식 응답 필드 이름은 서버에서 위 계약으로 변환.
프론트는 한 요청의 week 데이터를 받아 선택일 급식/주간시간표를 렌더하고 날짜변경을 지원한다. 동주 캐시는 프론트에서도 재사용 가능.

## 기록
기존 저장소 clean, 공개 버전2에서 시작. 사용자 저장완료 응답 후 서버 secret 등록(환경revision1), 로컬 원문삭제. 전체57개 테스트 및 브라우저·독립검토 완료. 실제 Accept 헤더 호환성, cache expiry, Worker의 redirect:error 미지원 문제는 실패 테스트 후 수정. 공개 버전4에서 익명 조회 급식14건·시간표37건 정상, 기존 앱 경로와 비공개 파일404 및 모바일 화면 확인. 배포 완료 증거는 작업공간 운영 기록에 남긴다.
