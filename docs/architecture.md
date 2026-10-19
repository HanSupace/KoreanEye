# 아키텍처

```text
Next.js App Router
   │ same-origin /api proxy
   ▼
Spring Boot REST API ── Spring Security JWT
   ├── Spring Data JPA ── Supabase PostgreSQL
   └── SpellCheckService
         ├── RuleBasedSpellCheckService
         ├── Gemini generateContent (선택)
         └── OpenAI Responses API (선택)
```

프런트엔드는 API 키를 받지 않습니다. Next.js rewrite가 브라우저의 `/api` 요청을 Spring API로 전달합니다. 보호자 토큰은 Bearer 방식으로 보내고, 자녀 데이터 조회는 Spring 서비스에서 보호자 소유권을 확인합니다.

글 분석은 `SpellCheckService` 인터페이스 뒤에 분리했습니다. 기본 규칙 기반 분석은 로컬에서 동작합니다. `AI_MODE=gemini`와 서버 환경 변수 `GOOGLE_GEMINI_API_KEY`를 설정하면 구조화된 Gemini 응답을 받습니다. 손글씨 인식용 Google Cloud Vision 키와 Gemini 분석 키는 별도로 설정합니다. OpenAI 응답은 `AI_MODE=openai`로 선택할 수 있습니다.

로컬 개발과 Docker Compose 모두 `.env`의 연결 정보를 사용해 Supabase PostgreSQL에 접속합니다. 로컬 PostgreSQL 및 H2 데이터베이스는 사용하지 않습니다. JPA의 `ddl-auto=update`는 개발 편의 설정이며, 배포 전에는 Flyway 마이그레이션으로 전환하는 것이 좋습니다.

