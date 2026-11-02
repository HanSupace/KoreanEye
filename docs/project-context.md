# 프로젝트 파악 메모

## 2026-10-27 전체 랭킹 및 글 분석 수정

- 가족 랭킹을 전체 학생 랭킹으로 변경. GET /api/rankings?period=week|all&studentId=... 는 선택 학생 소유권을 확인하고 모든 계정 학생의 점수·완료 챕터·글 수·활동일·공동 순위를 SQL로 집계한다. 공개 표시명은 실제 이름 대신 UUID 앞 8자리의 탐정 번호다. 글 원문과 보호자 정보는 반환하지 않는다.
- 사용자 명시적 동의 후 .env AI_MODE=gemini 활성화. 등록 키·모델을 사용한 비개인 예문 API 요청에 성공했다. Compose에도 Gemini 키와 모델 전달 추가. 예시 파일의 실제 Gemini 키는 제거했다.
- 규칙 검사 흔한 오타 8종 추가. WritingService는 AI 후보를 원문 인덱스로 정렬한 뒤 검증하여 응답 순서 때문에 유효 오류가 누락되는 문제를 수정했다. 오류 후보 0개를 무오류 확정처럼 표현하던 문구도 수정했다.
- 프론트 TypeScript 검사 1회 통과, 백엔드 테스트 9개 통과. 전체 랭킹 SQL의 실제 DB 실행 및 브라우저 동작은 미검증이다. 이미 실행 중인 서버는 환경 변수 변경을 읽도록 재시작해야 한다.

## 2026-10-25 검토 후 수정

- learning_chapter_questions.completedAt을 추가했다. 새로 완료하는 문제는 완료 시각을 보존하며, 챕터 완료일은 마지막 문제 완료 시각의 한국 날짜다. daily/history 및 랭킹 입력은 완료일로 집계한다.
- 이전 완료 기록에 완료 시각이 없으면 기존 챕터 날짜를 사용한다. 과거의 실제 완료 시각은 복원할 수 없다. JPA update가 nullable 컬럼을 추가하는 구조다.
- 학습 기록 응답이 도착하면 메인 화면을 표시한다. daily/review 요청은 독립적으로 상태를 갱신하며 해당 화면만 대기·오류 처리한다.
- 학습 시작 중복 클릭은 동기 ref 잠금으로 차단하며, 요청 중 학생 변경·로그아웃 시 이전 학생의 문제 응답을 적용하지 않는다. 백그라운드 기록 갱신이 새로 불러온 문제 목록을 지우지 않게 했다.

## 2026-10-24 기능 변경

- 공통 회전 로딩 표시, 로그인·OCR·처리 중 상태 표시 추가.
- 로그인 후 메인 셸을 먼저 표시하고 학습 기록을 백그라운드에서 조회한다. 문제 생성은 학습 시작 시에만 요청한다. 학습 기록 실패 시 재시도 화면 제공, 오래된 학생 조회 응답은 무시한다.
- 퀘스트는 오늘 챕터 완료 / 글쓰기 / 글의 오류 해결 세 가지를 실제 저장 기록으로 계산한다.
- 랭킹은 동일 보호자 계정 학생끼리 최근 7일/전체 기록 비교. 챕터 100점, 글쓰기 30점, 동점 공동 순위. 마이페이지에서 탐정 추가 가능.
- API 요청 25초 제한과 빈 성공 응답 처리를 추가했다.
- 이전 5문제 완료 기준을 10문제로 변경하고 테스트 생성자를 수정했다. 기존 테스트 3개와 완료 기준 테스트 2개가 있다.
- 아래 초기 조사 내용 중 5문제 판정·테스트 생성자 불일치 항목은 이 작업에서 수정되었다. 외부 DB·AI 연결과 실제 브라우저 조작은 이번 검증 범위에 포함하지 않았다.
- 검증 1회: Java 21에서 Gradle test 성공. npm run build는 컴파일·TypeScript·페이지 생성 성공 후 설치된 Next.js 16.4.0의 SecurityFatalError(보안 업데이트 요구)로 최종 종료 코드 1. 전체 빌드 성공으로 간주하지 않는다. 재실행하지 않았다.

2026-10-24 소스 확인 기준. 실행 검증이나 수정 작업은 수행하지 않았다. 이후 변경 시 실제 코드를 우선 확인한다.

## 목적과 구성

- KoreanEye 저장소의 서비스는 초등 1~3학년 한글 학습 MVP. 문서명은 한글 탐정단, 화면 브랜드는 한글탐정대, npm 이름은 hangul-detective.
- frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind 4. app/page.tsx가 components/app-shell.tsx를 렌더링한다. 화면 전환은 별도 URL 대신 AppShell의 page 상태로 처리한다.
- backend: Java 21, Spring Boot 3.5.16, Gradle, JPA, Spring Security JWT. 패키지 kr.co.hanguldetective 아래 auth/student/learning/writing/config.
- DB는 외부 Supabase PostgreSQL. 프론트의 /api 요청은 next.config.ts rewrite로 Spring에 전달한다. 브라우저에서 DB에 직접 접근하지 않는다.
- npm run dev: 프론트 3000, npm run backend: API 8080. Supabase 연결 환경 변수가 필요하다. Docker Compose도 제공한다.

## 핵심 동작

- 보호자 아이디 가입/로그인 → 자녀 등록·선택 → 챕터 학습 / 자유 글쓰기 / 복습.
- JWT는 localStorage의 hangul-detective-session에 사용자·선택 학생과 함께 저장한다. 서버는 학생 소유권을 검사한다. 비밀번호는 SHA-256 전처리 후 BCrypt, 이전 BCrypt 해시도 호환한다.
- LearningService가 시작 시 객관식 19개와 받아쓰기 20개를 시드한다. 현재 시드 학년은 모두 2이며 출제 시 1~3학년 전체를 조회한다.
- 챕터는 객관식 7개 + 받아쓰기 3개. 미완료 챕터를 이어가며 완료 후 다음 번호를 만든다. 3가지 패턴으로 문제 유형 순서를 바꾼다.
- 최근 30일 문제 시도·글 오류의 유형별 약점에 시간 감쇠를 적용하고, 최근 3일 푼 문제를 가능한 한 피한다.
- 정답 또는 건너뛰기는 챕터 항목을 완료시킨다. 오답·건너뛰기는 별도 question_review_items에 모아 챕터별 복습한다.
- 받아쓰기는 브라우저 speechSynthesis의 한국어 음성 사용. 타자 또는 Canvas 손글씨 → 서버 Google Cloud Vision OCR → 텍스트 답안으로 제출한다.
- 기본 입력 방식은 보호자 계정 preferences에 저장하며 글쓰기·받아쓰기 화면에서 개별 변경 가능하다.
- 자유 글은 최대 5,000자. AdaptiveSpellCheckService가 rules / gemini / openai를 선택한다. 외부 AI 모드 실패 시 오류를 반환하며 rules로 자동 대체하지 않는다.
- WritingService가 AI 오류의 원문 범위·표현 일치·중첩을 검사한 뒤 저장한다. 다시 쓰기 시도, 3단계 힌트, 해결 상태를 저장한다.
- 학습 노트는 완료 챕터 수로 경로를 표시한다. 랭킹은 다른 사용자 비교가 아닌 본인의 학습 일수·칭호다. 약점 및 주간 리포트 API는 구현되어 있다.
- 주요 테이블: parent_accounts, student_profiles, learning_questions, question_attempts, learning_chapters와 챕터 항목, question_review_items, writings, writing_errors.

## 후속 작업 시 참고할 차이와 미검증 사항

- README/API 문서의 5문제 설명은 실제 10문제 챕터와 다르다. daily/history/ranking 일부 완료 판정에도 5문제 기준이 남아 있다.
- LearningServiceTest는 현재 LearningService 생성자와 인자가 맞지 않는다. 테스트 실행 없이 소스에서 확인한 불일치다.
- 글 ErrorDto에 correct 및 힌트가 이미 포함된다. 다시 쓰기 응답만 정답을 제한하므로 문서의 정답 비공개 설명과 실제 데이터 전달 범위를 구분해야 한다.
- Compose의 API 환경 변수 목록에는 Gemini 키·모델이 없다. 로컬 application.yml에는 있다.
- JPA ddl-auto=update 사용. LearningChapterSchemaMigration은 시작할 때 제약·인덱스를 직접 변경한다. 정식 Flyway 체계는 아니다.
- 규칙 분석은 네 가지 예시 패턴에 한정된다. AI 프롬프트에는 사전 표준어 지침이 있지만 별도 사전 검증 구현은 확인되지 않았다.
- 실제 DB 연결, 빌드·테스트, 외부 API 호출, 브라우저 동작은 검증하지 않았다. 비밀 값이 들어갈 수 있는 .env는 열지 않았다.
- 조사 시작 시 Git 상태는 미추적 .vscode/만 있었다. 이 메모 외 코드 수정 없음.

## 읽기 환경

기본 Windows 샌드박스 실행은 setup refresh had errors로 실패했다. require_escalated 방식의 PowerShell 파일 읽기는 성공했다. 프로젝트 경로 자체는 접근 가능하다.
