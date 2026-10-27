package kr.co.hanguldetective.learning;

import java.security.Principal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import kr.co.hanguldetective.student.StudentService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/rankings")
public class RankingController {
    private final JdbcTemplate jdbc;
    private final StudentService students;
    public RankingController(JdbcTemplate jdbc, StudentService students) { this.jdbc=jdbc; this.students=students; }
    public record PublicStudent(UUID id, String name) {}
    public record RankingRow(PublicStudent student, int score, int chapters, int writings, int days, int rank) {}

    @GetMapping
    public List<RankingRow> list(@RequestParam(defaultValue="week") String period, @RequestParam UUID studentId, Principal principal) {
        students.requireOwned(studentId, principal.getName());
        if (!period.equals("week") && !period.equals("all")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"랭킹 기간을 확인해 주세요.");
        LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate since=period.equals("week")?today.minusDays(6):LocalDate.of(1970,1,1);
        return jdbc.query("""
            WITH activity AS (
                SELECT c.student_id,
                    COALESCE((MAX(q.completed_at) AT TIME ZONE 'Asia/Seoul')::date,c.chapter_date) AS day,
                    100 AS points, 1 AS chapters, 0 AS writings
                FROM learning_chapters c JOIN learning_chapter_questions q ON q.chapter_id=c.id
                GROUP BY c.id,c.student_id,c.chapter_date HAVING BOOL_AND(q.completed)
                UNION ALL
                SELECT student_id,(created_at AT TIME ZONE 'Asia/Seoul')::date,30,0,1 FROM writings
            ), totals AS (
                SELECT student_id,SUM(points) AS score,SUM(chapters) AS chapters,SUM(writings) AS writings,COUNT(DISTINCT day) AS days
                FROM activity WHERE day BETWEEN ? AND ? GROUP BY student_id
            )
            SELECT s.id,COALESCE(t.score,0) AS score,COALESCE(t.chapters,0) AS chapters,
                COALESCE(t.writings,0) AS writings,COALESCE(t.days,0) AS days,
                RANK() OVER (ORDER BY COALESCE(t.score,0) DESC) AS position
            FROM student_profiles s LEFT JOIN totals t ON t.student_id=s.id
            ORDER BY score DESC,s.id
            """, (rs,index) -> {
                UUID id=rs.getObject("id",UUID.class);
                return new RankingRow(new PublicStudent(id,"탐정-"+id.toString().substring(0,8)),rs.getInt("score"),rs.getInt("chapters"),rs.getInt("writings"),rs.getInt("days"),rs.getInt("position"));
            },java.sql.Date.valueOf(since),java.sql.Date.valueOf(today));
    }
}
