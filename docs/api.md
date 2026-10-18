# API 초안

모든 학생별 요청은 인증된 보호자가 해당 자녀를 관리할 권한이 있는지 서버에서 확인합니다. 이 초안의 API는 아직 구현되지 않았습니다.

| Method | Path | 목적 |
|---|---|---|
| POST | `/api/auth/signup` | 보호자 가입 |
| POST | `/api/auth/login` | 보호자 로그인 |
| GET / POST | `/api/students` | 자녀 목록 / 등록 |
| GET | `/api/students/{studentId}/daily-learning` | 오늘의 미션 요약 |
| GET | `/api/students/{studentId}/questions/today` | 가중 추천 문제 5개 |
| POST | `/api/questions/{questionId}/attempt` | 문제 풀이 저장 |
| POST | `/api/students/{studentId}/writings` | 글 저장 |
| POST | `/api/writings/{writingId}/analyze` | 글 분석 요청 |
| POST | `/api/writing-errors/{errorId}/attempt` | 오류 다시 쓰기 저장 |
| POST | `/api/writing-errors/{errorId}/hint` | 다음 단계 힌트 요청 및 사용량 저장 |
| GET | `/api/students/{studentId}/weaknesses` | 유형별 약점 요약 |
| GET | `/api/students/{studentId}/reports/weekly` | 보호자 주간 보고서 |

분석 결과는 `originalText`와 오류 배열을 포함하는 JSON으로 반환합니다. 각 오류는 원문 범위, 오답 표현, 제안 표현, 카테고리, 설명, 두 단계 힌트, 마지막 단계 선택지를 포함합니다. 서버는 모델 응답 파싱 실패를 안전하게 처리하고 결과를 검증해야 합니다.

