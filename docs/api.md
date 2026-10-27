# API

Base path는 `/api`입니다. 가입/로그인을 제외한 요청에 `Authorization: Bearer <JWT>`가 필요합니다.

| Method | Path | 기능 |
|---|---|---|
| POST | `/auth/signup` | 보호자 계정 생성 및 JWT 발급 |
| POST | `/auth/login` | 보호자 로그인 및 JWT 발급 |
| GET / POST | `/students` | 보호자 자녀 목록 / 자녀 등록 |
| GET | `/students/{studentId}/daily-learning` | 오늘의 미션 진행률 |
| GET | `/students/{studentId}/questions/today` | 맞춤 문제 5개 |
| POST | `/questions/{questionId}/attempt` | 학생 답안 저장 |
| POST / GET | `/students/{studentId}/writings` | 글 분석 및 저장 / 글 목록 |
| GET | `/writings/{writingId}` | 글과 오류 후보 조회 |
| POST | `/writing-errors/{errorId}/attempt` | 다시 쓰기 시도 저장 |
| POST | `/writing-errors/{errorId}/hint` | 단계별 힌트 사용 저장 |
| POST | `/writing-errors/{errorId}/review-complete` | 소유권 확인 후 복습 완료 저장 (204, 반복 호출 가능) |
| GET | `/students/{studentId}/weaknesses` | 유형별 약점 요약 |
| GET | `/students/{studentId}/reports/weekly` | 보호자 주간 보고서 |
| GET | `/health` | API 상태 확인 |

다시 쓰기 API는 정답을 먼저 반환하지 않고, 맞힌 경우에만 `correctExpression`을 돌려줍니다. AI 후보는 서버에서 원문 인덱스와 실제 표현이 일치하는지 확인하고 저장합니다.

글쓰기 복습 목록은 기존 `GET /students/{studentId}/writings`의 전체 글과 오류를 사용합니다. 완료 API는 기존 `writing_errors.solved`를 true로 저장하며 시도 횟수와 힌트는 변경하지 않습니다. 기존에 정답으로 해결한 오류도 완료로 표시됩니다. 해결 상태를 사용하는 약점·보고서에도 반영되며 별도 스키마 변경은 없습니다. 다른 보호자의 오류와 없는 오류는 모두 404를 반환합니다.

