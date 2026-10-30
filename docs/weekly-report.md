# 주간 학습 리포트

사이드바의 **복습 → 주간 리포트 → 마이페이지** 순서를 유지하며, 나의 학습 제목 옆 **주간 리포트 보기**로도 진입합니다. 기존 학습 지도, 문제 판정, 퀘스트 진행·보상, 손글씨·지우개·OCR 및 중앙 팝업은 변경하지 않았습니다.

## 수정·추가 파일

- 프론트엔드 신규: `frontend/components/weekly-report.tsx`, `frontend/lib/weekly-report.ts`
- 프론트엔드 연결·스타일: `frontend/components/app-shell.tsx`, `frontend/components/learning-notebook.tsx`, `frontend/components/detective-art.tsx`, `frontend/app/globals.css`
- 백엔드 신규: `backend/src/main/java/kr/co/hanguldetective/writing/WeeklyLearningReportController.java`, `WeeklyLearningReportService.java` (같은 디렉터리)
- 조회 쿼리 추가: `backend/src/main/java/kr/co/hanguldetective/learning/QuestionAttemptRepository.java`, `backend/src/main/java/kr/co/hanguldetective/writing/WritingEntryRepository.java`, `WritingErrorRepository.java` (마지막 두 파일은 같은 디렉터리)
- 신규 자동 테스트: `frontend/tests/weekly-report.test.cjs`, `frontend/tests/weekly-report-browser.test.cjs`, `backend/src/test/java/kr/co/hanguldetective/writing/WeeklyLearningReportTest.java`, `WeeklyLearningReportControllerTest.java` (마지막 두 파일은 같은 디렉터리)
- 구현·검증 문서: `docs/weekly-report.md`

## API와 집계 기준

`GET /api/students/{studentId}/reports/weekly-learning?weekStart=2026-10-26`

- 기존 JWT 인증을 사용하고 `StudentService.requireOwned`로 요청 학생의 소유자를 먼저 확인합니다.
- `weekStart` 생략 시 서버의 Asia/Seoul 기준 현재 월요일을 선택합니다. 월요일이 아닌 날짜와 미래 주는 400으로 거절합니다.
- 한국 시간 월요일 00:00 이상, 다음 월요일 00:00 미만을 UTC `Instant`로 변환해 조회합니다. 시작 시각도 포함됩니다.
- 기존 `/reports/weekly`는 최근 7일 글쓰기 요약이므로 호환성을 위해 유지하고, 새 화면은 새 API만 사용합니다.
- 소유권 확인 이후 지정 학생·지정 주간에 한정한 3개 projection 쿼리로 문제 제출, 글쓰기 시각, 글쓰기 오류 후보를 조회합니다. 엔티티 연관관계를 순회하지 않아 N+1 조회가 없습니다. 실제 DB의 실행 계획이나 인덱스 성능은 측정하지 않았습니다.
- 조회는 읽기 전용이며 학습 기록을 생성하거나 수정하지 않습니다. 스키마·인덱스 변경도 없습니다.

| 지표 | 현재 구현 |
| --- | --- |
| 해결한 문제 | `question_attempts.question_id`를 주간 전체에서 중복 제거. 정답·오답 모두 포함 |
| 요일별 문제 | 한국 날짜별 `question_id` 중복 제거. 일별 합이 주간 고유 수보다 클 수 있음을 안내 |
| 학습한 날 | 문제 제출·글쓰기의 한국 날짜를 합쳐 중복 제거한 **확인 가능한 날짜 수**. 복습만 한 날짜는 제외됨을 화면에 명시 |
| 다음 목표 | 주간 오답 문제를 유형별 고유 ID로 집계하고, 이번 주 글쓰기의 실제 교정 후보를 참고하는 규칙 기반 추천. 반복 제출로 가중하지 않음 |
| 복습한 단서·완료 | 주간 복습 시각을 알 수 없어 `null`, `reviewActivityAvailable=false`. 0이나 누적값으로 대체하지 않음 |

나의 학습과 퀘스트는 같은 문제 시작·제출 흐름과 문제 ID를 사용합니다. 리포트는 퀘스트 진행도나 챕터 완료 수를 더하지 않습니다. 페이지를 열거나 건너뛰면 `QuestionAttempt`가 생성되지 않으므로 문제 수에 포함하지 않습니다. 건너뛰기의 기존 완료·복습 저장 정책은 그대로입니다.

추천에서는 원문과 교정 표현이 같은 오류 후보 등 `WritingCandidateValidator`에서 실제 수정으로 인정하지 않는 후보를 제외합니다. 복습 시도 시각이 없는 데이터는 주간 추천에도 사용하지 않습니다. Gemini를 추가 호출하지 않습니다.

## 현재 데이터로 불가능한 부분

`WritingError`는 `attemptCount`, `solved`, 오류 후보 생성 시각만 저장합니다. `QuestionReviewItem`도 `reviewAttempts`, `solved`, 항목 생성 시각만 있습니다. **생성 시각은 복습 시각이 아닙니다.** 현재 값으로는 특정 주에 복습한 서로 다른 단서 수, 해당 주에 완료한 단서 수, 복습만 한 날짜를 복원할 수 없습니다. 빈 주도 복습이 없었다고 단정하지 않습니다.

추가 승인 후 가능한 최소 개선안은 복습 이벤트 이력을 별도로 저장하는 것입니다. 예를 들어 학생 ID, 단서 종류, 기존 단서 ID, UTC 시각, 시도/완료 구분, 정오답을 기록하면 주간 `distinct(종류, 단서 ID)`와 날짜를 정확히 계산할 수 있습니다. 쓰기·문제 복습 모두 대상입니다. 원문=교정인 후보를 제외하고, 전체 완료 버튼의 이벤트와 정답 제출 이벤트가 중복 완료로 집계되지 않도록 해야 합니다. 과거 기록은 추측해 채우지 않고 기록 시작일을 안내해야 합니다. **이 변경은 제안만 하며 적용하지 않았습니다.**

## 자동 검증

- `WeeklyLearningReportTest`: H2 메모리 DB에서 중복 제출, 정오답 혼합, 같은 문장의 서로 다른 ID, 주간·일별 차이, 다른 주 재풀이, 건너뛰기·미제출, 한국 날짜 경계·연말, 소유권·학생별 분리, 실제 교정 필터, 주간 복습 수의 집계 불가 표시, 읽기 시 데이터 불변 검증.
- `WeeklyLearningReportControllerTest`: 비로그인 401, JWT 주체·날짜 전달, 잘못된 날짜 400.
- `weekly-report.test.cjs`: 한국 시간 월요일/일요일/윤년/월·연 경계, 화면 로딩·오류·재시도·빈 데이터, 이전 주 이동, 늦은 응답 차단, 사용자 전환 시 이전 데이터 숨김, 추천과 메뉴·바로가기, 나의 학습·퀘스트의 동일 문제 API 사용 검증.
- `weekly-report-browser.test.cjs`: 테스트 전용 집계 데이터로 실제 Chrome의 1000/760/390/320px 카드·그래프 배치와 가로 넘침, 미래 주 버튼 비활성화 확인. 이 데이터는 테스트에만 존재하며 실제 서비스에서는 사용하지 않습니다.
- 기존 프론트엔드 손글씨·OCR 이미지·부분 지우개·로딩·욕설·복습 테스트도 함께 실행합니다. 실제 Google Vision/Gemini 호출이나 운영 Supabase 데이터 검증과는 구분합니다.

일반 실행 명령:

```powershell
node --test frontend/tests/*.test.cjs
npm.cmd run build --workspace frontend -- --webpack
cd backend
.\gradlew.bat test
```

Gemini 실호출 테스트는 환경 변수로 명시적으로 활성화할 때만 실행됩니다. 이번 검증에서는 비활성화합니다. 실제 Vision/Gemini 연동 및 운영 환경 전체 로그인·랭킹·마이페이지 수동 검증은 별도입니다.

### 이번 실행 결과

- 새 백엔드 집계·컨트롤러 테스트 13개 통과. 전체 백엔드 47개 중 44개 통과, 1개 실패, Gemini 실호출 2개 제외.
- 실패한 기존 `AccountControllerTest.deletionRemovesAllDependentRecordsAndPreservesOtherAccountsAndSharedQuestions`는 `ParentAccount` 관련 `TransientObjectException`입니다. 수정 전 HEAD의 백엔드를 별도 임시 폴더에 추출해 같은 테스트를 실행했을 때도 동일하게 재현되었습니다. 이번 범위에서 회원탈퇴 코드는 변경하지 않았습니다.
- Gradle 8의 Windows 한글 경로 때문에 처음에는 테스트 worker/클래스 로딩이 실패했습니다. 프로젝트·기존 Gradle 캐시에 임시 ASCII 드라이브 별칭을 연결해 Java 21로 실행했으며, 별칭은 검증 후 해제했습니다. Gradle wrapper 및 프로젝트 빌드 설정은 바꾸지 않았습니다.
- 프론트엔드는 신규 15개를 포함한 148개 테스트, TypeScript 검사 및 Webpack 프로덕션 빌드가 통과했습니다. 마지막 빌드의 샌드박스 디렉터리 쓰기 오류는 동일 명령을 샌드박스 밖에서 재실행해 해결했습니다. 브라우저 검사는 실제 Chrome에서 수행하고 API 응답 데이터는 테스트 전용 fixture를 사용했습니다. 운영 서버의 통계를 조회해 확인한 결과는 아닙니다.

## 웹사이트에서 확인하는 순서

1. 개발 서버에 기존 계정으로 로그인하고 학생을 선택합니다.
2. 사이드바에서 메뉴 순서를 확인하고 주간 리포트에 진입합니다. 나의 학습의 바로가기도 같은 화면을 여는지 확인합니다.
3. 나의 학습에서 한 문제를 여러 번 오답 제출한 뒤 리포트로 돌아옵니다. 문제 수는 1개이며 당일 막대에도 1개가 반영되어야 합니다. 같은 문장이어도 다른 문제 ID라면 별개입니다.
4. 퀘스트의 학습 시작으로 같은 문제에 제출했을 때 고유 문제 수가 중복 증가하지 않는지 확인합니다. 열기만 하거나 건너뛴 문제는 문제 수에 포함되지 않아야 합니다.
5. 이전 주·다음 주 이동, 현재 주의 다음 주 비활성화, 연말 기간 표시를 확인합니다.
6. 네트워크를 끊어 오류와 재시도를 확인합니다. 주간을 빠르게 바꾸거나 다른 학생으로 전환해 이전 결과가 잠깐 노출되거나 늦게 덮어쓰지 않는지 확인합니다.
7. 복습 수가 가짜 숫자로 표시되지 않는지와 복습 노트 이동 버튼을 확인합니다. 모바일에서는 카드가 세로로 쌓이고 가로 스크롤이 생기지 않는지 확인합니다.
