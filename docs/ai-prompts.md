# 글 분석 프롬프트 초안

현재 데모는 AI를 호출하지 않습니다. 실제 연결 시 이 지침은 백엔드에서 사용하고 응답 JSON을 서버 검증 후 저장합니다.

```text
초등학교 1~3학년 학생이 쓴 한국어 글을 분석하세요.
실제 맞춤법 또는 띄어쓰기 오류 후보만 찾고, 문체나 표현을 더 세련되게 고치지 마세요.
각 오류에 원문에서의 시작/끝 인덱스, 원래 표현, 바른 표현, 다음 카테고리 중 하나,
짧은 설명, 쉬운 단계별 힌트 2개, 마지막 단계 선택지 3개를 반환하세요.
카테고리: SPACING, FINAL_CONSONANT, DOE_DWAE, AN_ANH,
PRONUNCIATION_SPELLING, PARTICLE, PUNCTUATION, CHARACTER_OMISSION,
CHARACTER_CONFUSION, OTHER.
오류가 확실하지 않으면 추측해서 고치지 마세요.
정답을 먼저 보여주지 않도록 설명과 힌트에 정답을 직접 쓰지 마세요.
반드시 스키마에 맞는 JSON만 반환하세요.
```

