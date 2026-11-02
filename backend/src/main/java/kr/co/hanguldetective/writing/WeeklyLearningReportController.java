package kr.co.hanguldetective.writing;

import java.security.Principal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestController
public class WeeklyLearningReportController {
    private final WeeklyLearningReportService reports;
    public WeeklyLearningReportController(WeeklyLearningReportService reports) { this.reports = reports; }

    @GetMapping("/api/students/{studentId}/reports/weekly-learning")
    public WeeklyLearningReportService.Report get(@PathVariable UUID studentId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            Principal principal) {
        return reports.get(studentId, principal.getName(), weekStart);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> invalidParameter() {
        return ResponseEntity.badRequest().body(Map.of("message", "학생과 주간 날짜를 확인해 주세요."));
    }
}
