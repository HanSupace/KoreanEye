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

글 분석과 맞춤 예문 생성은 서버에서 선택한 AI 제공자를 사용합니다. `.env`에 `OPENAI_API_KEY`와 `GOOGLE_GEMINI_API_KEY`를 각각 보관하고, `AI_MODE=gemini` 또는 `AI_MODE=openai` 한 줄로 제공자를 전환합니다. 각 모델은 `GOOGLE_GEMINI_MODEL`과 `OPENAI_MODEL`로 별도 지정할 수 있습니다. 손글씨 인식용 Google Cloud Vision 키는 두 AI 키와 별개입니다.

로컬 개발과 Docker Compose 모두 `.env`의 연결 정보를 사용해 Supabase PostgreSQL에 접속합니다. 로컬 PostgreSQL 및 H2 데이터베이스는 사용하지 않습니다. JPA의 `ddl-auto=update`는 개발 편의 설정이며, 배포 전에는 Flyway 마이그레이션으로 전환하는 것이 좋습니다.

