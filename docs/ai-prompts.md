# AI 분석

Gemini 분석은 Spring 서버에서만 호출하며 `generateContent`의 구조화된 JSON 출력으로 `errors` 배열을 받습니다. 기본 모델은 `gemini-3.1-flash-lite`이며 `GOOGLE_GEMINI_MODEL`로 바꿀 수 있습니다. OpenAI Responses API 구현은 `AI_MODE=openai`로 선택할 수 있습니다.

분석 지침은 초등학교 1~3학년 글에서 확실한 맞춤법/띄어쓰기 후보만 찾고 문체를 교정하지 않으며, 원문 인덱스, 짧은 설명, 정답을 직접 말하지 않는 힌트 두 단계, 마지막 단계 선택지를 반환하도록 구성했습니다. 서버는 응답의 원문 범위와 표현 일치를 검증합니다. 외부 AI로 자유 글을 전송하기 전에 어린이 개인정보 안내와 보호자 동의 흐름을 제품화해야 합니다.

