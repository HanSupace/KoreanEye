package kr.co.hanguldetective.learning;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LearningChapterSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    public LearningChapterSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE learning_chapters DROP CONSTRAINT IF EXISTS uk_learning_chapter_student_date");
        jdbc.execute("ALTER TABLE question_review_items DROP CONSTRAINT IF EXISTS uk_question_review_student_chapter_question");
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_question_review_student_chapter_question_number ON question_review_items (student_id, chapter_date, chapter_number, question_id)");
    }
}
