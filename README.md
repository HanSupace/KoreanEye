# 한글 탐정단

초등학교 1~3학년 학생의 실제 글을 학습 이력으로 저장하고, 맞춤 문제와 다시 쓰기로 연결하는 풀스택 MVP입니다.

## 구성

- `frontend/`: Next.js App Router, TypeScript, React, Tailwind CSS
- `backend/`: Java 21, Spring Boot 3.5, Spring Web, JPA, Spring Security JWT
- PostgreSQL: Docker Compose로 실행
- 글 분석: `SpellCheckService` 뒤에 규칙 기반 분석과 OpenAI Responses API 구현을 분리

## 실행 방법

### Docker Compose로 전체 실행

Docker Desktop을 실행한 다음 프로젝트 루트에서 실행합니다.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- 웹앱: http://localhost:3000
- API 상태 확인: http://localhost:8080/api/health
- PostgreSQL: localhost:5432

웹앱은 로그인 없이 바로 이용할 수 있습니다. 처음 접속하면 이 브라우저 전용 로컬 이용 세션이 자동으로 만들어지고, 탐정 이름과 학년만 등록하면 학습 화면으로 이동합니다. 학습 내용은 실행 중인 백엔드와 데이터베이스에 저장됩니다. 예시 글에는 “예시 문장 넣기”를 사용할 수 있습니다.

### 로컬 개발 실행

Node.js 20.9 이상과 Java 21이 필요합니다. PostgreSQL 대신 백엔드 개발에 H2 로컬 프로필을 사용할 수 있습니다.

프로젝트 루트(`C:\Workspace\KoreanEye`)에서 백엔드를 실행합니다.

```powershell
npm run backend
```

프런트엔드는 별도 터미널에서 실행합니다.

```powershell
npm run dev
```

### Supabase PostgreSQL 사용

1. Supabase에서 프로젝트를 만들고 리전을 **Seoul (`ap-northeast-2`)**로 선택합니다.
2. Dashboard의 **Connect** 화면에서 DB host, port, username을 확인합니다. 실행 중인 Spring Boot 백엔드는 직접 연결을 사용하고, 네트워크가 IPv4 전용이면 Session pooler 연결값을 사용합니다.
3. 프로젝트 루트에서 `.env.example`을 `.env`로 복사한 뒤 `SUPABASE_JDBC_URL`, `SUPABASE_DB_USERNAME`, `SUPABASE_DB_PASSWORD`를 실제 값으로 채웁니다. DB 비밀번호는 `.env`에만 두고 저장소에 올리지 않습니다.
4. 백엔드는 `npm run backend:supabase`로, 프런트엔드는 다른 터미널에서 `npm run dev`로 실행합니다.

`npm run backend`는 기존처럼 로컬 H2를 사용합니다. Supabase 프로필은 앱의 API 서버가 Supabase PostgreSQL에 직접 연결하며, 프런트엔드에서 DB에 직접 접근하지 않습니다. Supabase는 [서울 리전](https://supabase.com/docs/guides/platform/regions)을 제공하고 연결 방식은 [공식 DB 연결 안내](https://supabase.com/docs/guides/database/connecting-to-postgres)를 따릅니다.

기존 방식으로 직접 실행하려면 아래 명령을 사용합니다.

```powershell
cd backend
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

프런트엔드는 `/api` 요청을 `http://localhost:8080`으로 전달합니다.

## AI 분석 설정

기본값 `AI_MODE=rules`는 예제 규칙으로 작동합니다. OpenAI 기반 후보 분석을 사용할 때 `.env`에 다음 값을 설정합니다.

```dotenv
AI_MODE=openai
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-6-astra
```

키는 Spring Boot 서버에서만 사용합니다. 분석 결과는 서버가 원문 범위와 표현 일치를 확인한 뒤 저장합니다. AI 요청 실패 시 규칙 기반 분석으로 전환합니다. 자유 글은 외부 AI로 전송될 수 있으므로 어린이 개인정보 안내와 보호자 동의 흐름을 준비해야 합니다.

## 구현된 흐름

- 로그인 화면 없이 로컬 이용 세션을 자동 생성하고 JWT로 API를 호출
- 한 보호자 계정의 여러 자녀 프로필 등록 및 선택
- 오늘의 문제 5개 조회와 답안 저장
- 자유 글 저장, 규칙/AI 분석 및 오류 후보 저장
- 학생이 직접 오류를 다시 쓰고 단계별 힌트를 요청
- 시도 횟수와 힌트 사용량을 PostgreSQL에 보관
- 학습 기록, 약점 유형, 반복 오류, 주간 요약 API
- 비밀번호 BCrypt 해시와 학생 소유권 서버 검증

## 현재 MVP의 경계

- 규칙 분석은 일부 예시 표현을 다룹니다. AI 후보도 정답 검증 엔진을 대체하지 않습니다.
- 인증 토큰은 브라우저 localStorage에 보관합니다. 실제 서비스 전에 HttpOnly 쿠키, 보안 점검, 비밀번호 재설정, 이메일 확인, 가입 제한을 추가해야 합니다.
- JWT 기본 키와 PostgreSQL 기본 암호는 로컬 개발용입니다. 배포 시 강한 비밀값으로 교체해야 합니다.
- 주간 변화 비교와 정확도는 학습 표본이 충분해진 뒤 고도화해야 합니다.
- 손글씨 입력/OCR, 교사 기능, 결제, PWA는 아직 연결하지 않았습니다.

## 프로젝트 구조

```text
frontend/     Next.js 사용자 화면 및 API 클라이언트
backend/      Spring Boot API, 인증, JPA 엔터티, 분석 서비스
docs/         구조, API, DB, AI 계약
compose.yaml  웹/API/PostgreSQL 개발 환경
```
