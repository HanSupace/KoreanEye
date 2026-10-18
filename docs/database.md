# 데이터 모델

현재 Spring Data JPA가 PostgreSQL 테이블을 생성/갱신합니다. 프로덕션 배포 전에 스키마 변경을 Flyway migration으로 옮겨야 합니다.

- `parent_accounts`: 이메일, BCrypt 암호 해시, 생성 시각
- `student_profiles`: 보호자 외래 키, 이름/별명, 1~3학년
- `learning_questions`: 문제 유형, 학년, 선택지 JSON, 정답, 설명, 시드 키
- `question_attempts`: 학생, 문제, 답, 정오, 제출 시각
- `writings`: 학생, 원문, 입력 방식, 작성 시각
- `writing_errors`: 글, 원문 인덱스, 오답/정답 표현, 유형, 힌트 단계, 시도 횟수, 해결 여부

약점과 주간 리포트는 학습 이력에서 계산합니다. 학생 데이터 API는 JWT 주체 이메일과 자녀의 보호자 관계를 검증합니다.

