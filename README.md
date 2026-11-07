# 교실 도구함

Google 홈페이지의 여백·중앙 검색·다색 포인트를 참고한 웹앱 허브입니다. **무작위 번호 뽑기**, **자리 배정**, **한솔고 급식·시간표**를 제공합니다. 앞의 두 도구는 브라우저에서 동작하며, 학교 정보는 서버가 나이스를 조회합니다. 학생은 인증키 입력·회원가입 없이 사용할 수 있습니다.

## 실행

Node.js 22 이상에서 프로젝트 폴더를 열고 실행하세요. 패키지 설치는 필요 없습니다.

```sh
npm run dev
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. ES 모듈과 루트 경로를 사용하므로 HTML 파일을 더블클릭하는 방식은 지원하지 않습니다.

```sh
npm test
```

## 할 수 있는 일

- 도구 검색·분류·즐겨찾기
- 개인 앱 링크 추가·수정·삭제(최대 100개)
- 개인 앱·즐겨찾기 JSON 백업·복원(최대 512KB, 복원 전 교체 확인)
- 번호 1~999, 제외 번호, 한 번에 최대 100개 추첨
- 한 회차 안에서는 항상 중복 없이 추첨. ‘이미 뽑은 번호 제외하기’를 켜면 회차 사이에도 중복 방지
- 큰 결과 화면·전체 화면·최근 20회 기록
- 자리 배정: 짝꿍 두 자리씩 3분단·5행, 최대30명, 제외 번호·고정석·빈자리 지정
- 고정석과 지정한 빈자리를 유지하며 나머지 번호를 무작위 배정, 다시 섞기, 배정표 인쇄/PDF 저장
- 세종 한솔고등학교2학년8반의 날짜별 급식과 주간 시간표. 원본 알레르기 번호와 복수 과목 표시, 주말·미등록 자료 안내.

## 급식·시간표 운영

학교·학급은 한솔고등학교(세종 I10/9300058)2학년8반으로 고정했습니다. 나이스에 학교가 등록한 자료를 조회하며, 학교의 시간표 변경이 반영되는 시점에 따라 실제 수업과 차이가 있을 수 있습니다.

`NEIS_API_KEY`는 **Firebase Secret Manager**에 등록하고 학교 조회 함수에만 연결합니다. 공개 코드·일반 백업·학생 화면에는 키를 넣지 않습니다. 키를 바꾼 경우 학교 조회 함수를 다시 배포해야 합니다. 서버는 현재 연도의 앞뒤1년 날짜만 받고, 임의 학교·URL을 전달하는 프록시는 제공하지 않습니다. 같은 주의 정상 데이터를5분 캐시합니다. 이전 Sites 배포의 키 설정은 Firebase로 자동 복사되지 않습니다.

## Firebase 배포

Node.js22와 npm, Firebase CLI 로그인이 필요합니다. 학교 조회 서버는 결제 계정을 연결한 Blaze 프로젝트가 필요하며 무료량 초과·배포 파일 보관 등으로 비용이 발생할 수 있습니다. `maxInstances:1`은 요금 상한이 아닙니다.

```sh
npm ci --prefix server
npm test
npm run build
npx -y firebase-tools@latest login
npx -y firebase-tools@latest functions:secrets:set NEIS_API_KEY --project webapphub-hayong
npx -y firebase-tools@latest deploy --only functions,hosting --project webapphub-hayong
```

이 저장소의 기본 Firebase 프로젝트는 `webapphub-hayong`입니다. 다른 계정에서 복제하는 경우 프로젝트 설정을 변경하세요. 키는 CLI의 숨김 입력에만 입력하고 코드·셸 명령·채팅에 넣지 않습니다. Hosting은 `firebase-public/`에 생성한 공개 파일만 배포하며, `dist/server/`와 숨김 파일은 복사하지 않습니다. 로컬에 이전 Sites 설정을 보관한 경우에만 `npm run build:sites`를 사용할 수 있습니다. 해당 공급자 설정과 생성 서버 번들은 GitHub 업로드 대상에서 제외합니다.

```sh
npx -y firebase-tools@latest emulators:start --only hosting,functions --project demo-classroom-toolbox
```

에뮬레이터는 `http://127.0.0.1:5000`에서 확인합니다. 실제 키가 없으면 학교 조회 준비 중(503)을 표시하고 나머지 도구는 동작합니다. 도메인을 바꾸면 개인 앱·즐겨찾기는 기존 사이트에서 JSON 내보내기 후 새 사이트에서 가져와야 합니다.

로컬 개발은 키 없이도 기존 두 도구와 화면을 확인할 수 있습니다. 학교 데이터의 실제 로컬 조회가 필요하면 `NEIS_API_KEY` 환경변수를 사용하거나 로컬 검증용 숨김 stdin 입력을 사용할 수 있습니다. 키를 명령줄 인자에 넣거나 파일을 Git에 추가하지 마세요.

운영 빌드:

```sh
node scripts/build-worker.mjs
```

기존 `dist`의 공개 HTML/CSS/JS/이미지만 자가완결 Worker `dist/server/index.js`에 포함합니다. `.env` 및 숨김 파일·서버 소스·일반 문서는 공개 자원 목록에서 제외합니다. `.openai/hosting.json`은 같은 project_id를 유지하고 Worker 배포에서는 static 항목을 쓰지 않습니다.

## 자리 배정 사용하기

1. 허브에서 ‘자리 배정’을 엽니다. 짝꿍 두 자리씩3분단, 5행의30석입니다.
2. 학생 수(최대30명)와 제외 번호를 정합니다.
3. 자리 편집에서 좌석을 클릭하여 자동 배정·빈자리·번호 고정을 선택합니다. 고정석은 다시 섞어도 유지되며, 지정 빈자리에는 배정하지 않습니다.
4. 배정하기를 누르면 나머지 번호를 중복 없이 배정합니다. 조건을 바꾸면 새로 배정해야 인쇄할 수 있습니다. 마지막 성공 결과는 결과 보기에서 확인할 수 있습니다. 학생 수·제외 번호를 바꿀 때 고정번호와 충돌하면 안내에 따라 고정을 해제하거나 조건을 수정하세요.
5. 인쇄 버튼에서 종이로 인쇄하거나 브라우저의 PDF 저장을 선택합니다. 결과는 현재 탭에서만 유지되며 새로고침하면 사라집니다.

## 개인 목록과 공개 목록

**앱 추가 버튼**은 현재 브라우저에만 링크를 저장합니다. 다른 방문자에게 공개되거나 기기 간 자동 동기화되지 않습니다. 브라우저 데이터를 지우면 개인 목록도 사라지므로 중요한 목록은 백업하세요. 저장이 차단되면 현재 탭에서는 계속 사용할 수 있고 경고를 표시합니다.

**모든 방문자에게 보이는 공개 앱**을 추가하려면 `dist/lib/catalog.mjs`의 `catalog` 배열을 수정한 후 재배포합니다. 기존 id는 유지하고 새 id는 고유하게 만드세요.

```js
{
  id: 'new-classroom-tool',
  title: '새 수업 도구',
  description: '도구가 하는 일을 한 줄로 적어 주세요.',
  category: '수업 도구',
  url: '/apps/new-classroom-tool/',
  icon: 'book',
  builtin: true
}
```

내장 앱은 `dist/apps/new-classroom-tool/index.html`에 만드세요. 외부 공개 앱 링크라면 HTTPS 주소를 쓰고 `builtin: false`로 지정합니다. 공개 목록의 항목은 URL 종류에 관계없이 개인 편집/삭제 대상이 아닙니다. 제공 아이콘은 `grid`, `dice`, `folder`, `book`, `star` 등이며 `dist/lib/ui.mjs`에서 확인할 수 있습니다.

현재 분류는 수업 도구 / 교과 학습 / 학급 운영 / 창작 활동 / 종합 허브입니다. 공개 앱 id를 삭제하면 과거 즐겨찾기 백업과의 호환성을 고려해야 합니다. 공개 목록의 id는 바꾸거나 제거하기보다 같은 id로 내용을 갱신하는 것을 권장합니다.

## 구조

```text
dist/
  index.html, styles.css, hub.mjs   허브
  lib/catalog.mjs                  공개 도구 목록
  lib/core.mjs                     추첨·입력·백업 검증
  lib/ui.mjs                       공통 화면 도우미
  apps/number-picker/              첫 번째 내장 앱
  apps/seating-chart/              짝꿍 3분단 자리 배정
  apps/school-life/                급식·주간 시간표
server/school-api.mjs              인증키를 서버에서만 쓰는 나이스 조회
tests/core.test.mjs                핵심 회귀 테스트
scripts/serve.mjs                  로컬 확인용 정적 서버
server/index.mjs                   Firebase Functions 진입점
scripts/build-firebase.mjs         공개 자원만 생성 폴더로 복사
firebase.json, .firebaserc         Firebase 배포 설정
docs/                             명세서·검증 기록
```

## 저장·사용 범위

학생 이름·명단·성적을 입력하지 않습니다. 번호 추첨 기록은 메모리에만 있으며 새로고침·초기화 시 지워집니다. 설정 중 번호 범위·제외 번호·중복 옵션을 바꾸면 다음 추첨 때 새 세션이 시작됩니다. 한 번에 뽑을 개수만 바꾸면 기존 회차를 이어갑니다. 외부 추적 스크립트와 외부 폰트는 없습니다. 링크를 열면 해당 서비스의 정책이 적용됩니다.

이 앱은 수업용 간단한 무작위 선택 도구이며 감사 가능한 공식 추첨 시스템은 아닙니다. 완전한 오프라인 재방문, 계정, 다중 기기 자동 동기화는 구현하지 않았습니다.

## 배포·등록

위 Firebase 배포 절차를 사용합니다. 변경 시 핵심 테스트와 영향받은 화면을 검증한 뒤 같은 프로젝트에 배포하세요. 배포·등록 결과는 작업공간의 운영 기록에 별도로 남깁니다. 기존 별자리 등록은 이미 승인됐으며 현재 이전 사이트 URL을 가리킵니다. 같은 URL의 재배포는 다시 등록하지 않습니다. 공개 주소를 바꾸는 경우 운영자의 새 접수·기존 카드 취소 안내에 따라 별도로 처리해야 합니다.

등록 안내: https://github.com/Taehwan-Shin/teacher-hub/blob/main/REGISTRATION_API.md
