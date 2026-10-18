# 아키텍처

## 현재 MVP

현재 앱은 `index.html` 안의 정적 UI와 브라우저 JavaScript로 동작합니다. 프로필과 학습 내역은 브라우저 `localStorage`에 저장되고, 규칙 기반 분석은 시연 가능한 일부 표현만 다룹니다. 서버 연결이나 OpenAI 호출은 없습니다.

## 서비스 확장 구조

```text
Next.js 웹 클라이언트
        ↓ REST API
Spring Boot (인증, 권한, 학습 서비스, AI 서비스 인터페이스)
      ↙       ↘
PostgreSQL   OpenAI API
                  
향후 OCR: Spring Boot → FastAPI OCR 서비스
```

프론트엔드가 OCR 서버나 OpenAI를 직접 호출하지 않습니다. 분석 구현은 `SpellCheckService` 인터페이스 뒤에 두고, 컨트롤러와 도메인 서비스에서 공급자 구현을 분리합니다. OCR 확장 시 `OcrService`가 손글씨 인식 결과와 신뢰도를 전달하고, 인식 불확실성을 맞춤법 오답으로 저장하지 않도록 구분합니다.

## 권장 구현 순서

1. Spring Boot REST API, PostgreSQL 및 마이그레이션 구성
2. 보호자 인증과 자녀별 데이터 접근 제어
3. 오늘의 문제와 풀이 저장
4. 글쓰기 분석, 오류 재도전 및 힌트 저장
5. 카테고리 약점 집계와 가중 문제 추천
6. 주간 보호자 리포트

