# 한글 탐정단

## 추가된 화면 기능

- 로그인 뒤 학습 기록을 불러올 때 로딩 애니메이션과 실패 시 재시도를 표시합니다. 문제는 학습을 시작할 때 불러옵니다.
- 오늘의 퀘스트: 10문제 챕터 완료, 글쓰기, 오늘 쓴 글의 단서 해결을 기록에 따라 완료 처리합니다.
- 전체 탐정 랭킹: 다른 계정의 학생도 탐정 번호로 표시하고 최근 7일/전체 기록을 비교합니다. 챕터 완료는 100점, 글쓰기 한 편은 30점이며 동점은 공동 순위입니다. 실제 이름과 글 내용은 공개하지 않습니다.

초등학교 1~3학년 학생의 실제 글을 학습 이력으로 저장하고, 맞춤 문제와 다시 쓰기로 연결하는 풀스택 MVP입니다.

## 구성

- `frontend/`: Next.js App Router, TypeScript, React, Tailwind CSS
- `backend/`: Java 21, Spring Boot 3.5, Spring Web, JPA, Spring Security JWT
- 데이터베이스: Supabase PostgreSQL
- 글 분석: `SpellCheckService` 뒤에 규칙 기반 분석과 OpenAI Responses API 구현을 분리

## 실행 방법

### Supabase 연결 설정

Supabase Dashboard에서 프로젝트를 만든 뒤 **Connect → Session pooler**의 데이터베이스 연결 정보를 준비합니다. 직접 연결은 IPv6가 필요할 수 있어, 이 프로젝트의 기본 설정은 Session pooler를 사용합니다.

프로젝트 루트의 `.env`에 다음 값을 설정합니다. `.env.example`을 복사해 시작할 수 있습니다.

```dotenv
SUPABASE_JDBC_URL=jdbc:postgresql://<Supabase-host>:5432/postgres?sslmode=require
SUPABASE_DB_USERNAME=postgres
SUPABASE_DB_PASSWORD=<Supabase-database-password>
```

이 값은 백엔드와 Docker Compose가 Supabase에 연결할 때 사용합니다. `.env`는 저장소에 포함하지 마세요.

### Docker Compose로 실행

Docker Desktop을 실행한 다음 프로젝트 루트에서 실행합니다.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

`.env`에 실제 Supabase 접속 정보를 입력한 뒤 실행합니다. Compose는 로컬 데이터베이스를 만들지 않습니다.

- 웹앱: http://localhost:3000
- API 상태 확인: http://localhost:8080/api/health
- 데이터베이스: Supabase PostgreSQL

처음 접속하면 아이디 로그인 또는 회원가입이 필요합니다. 학습 기록은 Supabase에 저장됩니다. 예시 글에는 “예시 문장 넣기”를 사용할 수 있습니다.

### 로컬 개발 실행

Node.js 20.9 이상과 Java 21이 필요합니다. 백엔드는 `.env`의 Supabase 연결 정보가 있어야 시작됩니다.

프로젝트 루트(`C:\Workspace\KoreanEye`)에서 백엔드를 실행합니다.

```powershell
npm run backend
```

프런트엔드는 별도 터미널에서 실행합니다.

```powershell
npm run dev
```

백엔드는 `npm run backend`로 실행하고, 프런트엔드는 별도 터미널에서 `npm run dev`로 실행합니다. 프런트엔드는 `/api` 요청을 `http://localhost:8080`으로 전달하며 DB에 직접 접근하지 않습니다.

## AI 분석 설정

두 제공자 키를 `.env`에 저장한 뒤 `AI_MODE` 한 줄로 사용할 AI를 선택할 수 있습니다. Gemini를 선택하려면:

```dotenv
AI_MODE=gemini
GOOGLE_GEMINI_API_KEY=your-server-side-key
GOOGLE_GEMINI_MODEL=gemini-3.1-flash-lite
GOOGLE_GEMINI_FALLBACK_MODEL=gemini-3.6-flash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-6-astra
```

OpenAI로 바꿀 때는 키를 그대로 두고 `AI_MODE=openai`로 변경한 뒤 백엔드를 재시작하면 됩니다. 다시 Gemini를 쓰려면 `AI_MODE=gemini`로 되돌립니다. `AI_MODE=rules`는 외부 AI를 사용하지 않습니다.

Gemini 키는 Google AI Studio에서 만들며, 손글씨 인식용 `GOOGLE_CLOUD_VISION_API_KEY`와 별개입니다. 키는 Spring Boot 서버에서만 사용합니다. 분석 결과는 서버가 원문 범위와 표현 일치를 확인한 뒤 저장합니다. AI 요청 실패 시 사용자에게 오류를 표시하며 규칙 기반 분석으로 조용히 전환하지 않습니다. 자유 글은 외부 AI로 전송될 수 있으므로 어린이 개인정보 안내와 보호자 동의 흐름을 준비해야 합니다.

## 손글씨 입력 설정

Google Cloud 프로젝트에서 Cloud Vision API를 사용 설정하고 API 키를 만든 다음, 프로젝트 루트 `.env`에 입력합니다.

```dotenv
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key
AI_MODE=gemini
GOOGLE_GEMINI_API_KEY=your-google-ai-studio-api-key
GOOGLE_GEMINI_MODEL=gemini-3.1-flash-lite
```

키는 백엔드에서만 사용합니다. 로그인한 뒤 마이페이지에서 기본 입력 방식을 고를 수 있고, 글쓰기와 받아쓰기 화면의 타자/손글씨 버튼으로 그때그때 바꿀 수도 있습니다. 손글씨는 Vision API가 텍스트로 바꾼 뒤 글쓰기 분석 흐름으로 전달됩니다. 받아쓰기는 인식된 텍스트를 정답 확인 전에 보여줘 직접 확인하고 고칠 수 있습니다.

## 구현된 흐름

- 아이디 회원가입/로그인, BCrypt 비밀번호 해시, JWT 인증
- 한 보호자 계정의 여러 자녀 프로필 등록 및 선택
- 오늘의 문제 5개 조회와 답안 저장
- 자유 글 저장, 규칙/AI 분석 및 오류 후보 저장
- 학생이 직접 오류를 다시 쓰고 단계별 힌트를 요청
- 시도 횟수와 힌트 사용량을 Supabase PostgreSQL에 보관
- 학습 기록, 약점 유형, 반복 오류, 주간 요약 API
- 비밀번호 BCrypt 해시와 학생 소유권 서버 검증

## 현재 MVP의 경계

- 규칙 분석은 일부 예시 표현을 다룹니다. AI 후보도 정답 검증 엔진을 대체하지 않습니다.
- 인증 토큰은 브라우저 localStorage에 보관합니다. 실제 서비스 전에 HttpOnly 쿠키, 보안 점검, 비밀번호 재설정, 이메일 확인, 가입 제한을 추가해야 합니다.
- JWT 개발용 기본 키는 배포 전에 강한 비밀값으로 교체해야 합니다.
- 주간 변화 비교와 정확도는 학습 표본이 충분해진 뒤 고도화해야 합니다.
- 교사 기능, 결제, PWA는 아직 연결하지 않았습니다.

## 프로젝트 구조

```text
frontend/     Next.js 사용자 화면 및 API 클라이언트
backend/      Spring Boot API, 인증, JPA 엔터티, 분석 서비스
docs/         구조, API, DB, AI 계약
compose.yaml  웹/API와 Supabase PostgreSQL 연결 설정
```
