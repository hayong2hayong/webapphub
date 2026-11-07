# 자리 배정 구현 계획

Goal: 사용자가 수정한 짝꿍 3분단×5행·최대30명 자리 배정과 고정석·빈자리 지정 기능을 기존 공개 허브에 추가한다.
Spec: ../specs/2026-11-07-seating-chart-design.md
Stack: 기존 정적 HTML/CSS/JS, Node test, 기존 Sites 프로젝트.

## 인터페이스
- `dist/apps/seating-chart/seating-core.mjs`:
  - `validateSeatingOptions({studentCount,rows=5,columns=6,excluded=[],blocked=[],fixed=[]})` → 정규화된 같은 구조. studentCount 1~30, rows5/columns6 고정. blocked는 지정빈자리0~29, fixed는 `{seat,number}` 배열. 중복/제외/빈자리 충돌 검증.
  - `createSeatingChart(options,randomInt=randomInteger)` → `{rows,columns,cells,blocked,fixed,studentCount,assignedCount}`. cells는 행 우선 number|null 배열. 고정석을 먼저 놓고 나머지 번호·빈자리만 섞는다. 좌석 부족·전부 제외·잘못된 입력은 throw. 입력 불변.
  - 재사용 `../../lib/core.mjs`의 parseExcluded와 randomInteger.
- UI는 위 두 함수를 사용하며 범위·좌석 제외·설정 오류 시 기존 성공 결과를 유지한다. 초안 설정과 표시 중인 결과를 명확히 구분한다.
- 공개 id `seating-chart`, URL `/apps/seating-chart/`, 분류 학급 운영.

## 작업
- [x] 1. Node 테스트 먼저 작성: 고정석 보존, 번호 중복 금지, 빈자리, 고정번호 충돌, 경계값, 전부 제외, 좌석 부족, 입력 불변. 실패 확인 후 핵심 모듈 구현, 전체23/23 통과.
- [x] 2. 독립 UI 파일 index.html / seating.css / seating.mjs를 짝꿍3분단×5행으로 구현. 자리별 자동/빈자리/번호고정 대화상자, 지난 결과 보존, 인쇄·모바일 포함.
- [x] 3. catalog·허브 빠른 실행·이용 안내 업데이트. 저장된 이전 목록/두 번째 앱 즐겨찾기 백업 검증. 기존 개인 id 충돌도 로딩 시 자료 손실 없이 처리.
- [x] 4. 최종 짝꿍형 브라우저 QA: 기본30명, 번호고정/빈자리 지정, 다시 섞기에서 고정 보존, 충돌 오류에서 결과 보존, 키보드, 모바일/데스크톱. 핵심·호환 테스트 및 독립 검토.
- [ ] 5. 문서 업데이트, 같은 Sites source helper로 커밋·패키지·공개 배포. 실제 공개 URL에서 신규 기능 확인. 별자리 재등록 없음.

## 기록
- 기존 working tree clean, baseline 11/11.
- 소스 helper로 기존 커밋 a470b51bfaa7912e647069898bd28b6d19e5a84b 확인. 기존 Site public 유지.
- 작업 분담: 핵심 로직·통합·테스트·배포는 주 에이전트, 독립 UI 파일은 별도 작업자.
- 핵심·호환 테스트: 미구현 실패 확인 → 구현 후 전체20/20 통과. 브라우저에서 새 앱 즐겨찾기 저장→재방문→즐겨찾기 필터 유지 확인.
- 최종 검토 수정: 백업 가져오기에도 충돌 id 마이그레이션 적용. 실패 테스트 후21/21 통과. 모바일 100석에서 넘침 재현→좌석의 absolute 좌표 텍스트를 내부에 묶어 해결, 동일 조건으로 검증. 인쇄 출력물의 QA 한계는 VERIFICATION.md에 기록.
- 사용자 수정으로 기존 일반 격자 QA는 중간 버전 기록이 되었다. 대기 중이던 소스 helper는 취소(exit1)했고 중간 버전은 배포하지 않았다. 최종 짝꿍형으로 검증·배포한다.
