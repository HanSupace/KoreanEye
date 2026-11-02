package kr.co.hanguldetective.writing;

import java.time.LocalDate;
import java.util.*;
import kr.co.hanguldetective.auth.ParentAccountRepository;
import kr.co.hanguldetective.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = WeeklyLearningReportController.class, properties = {
    "spring.config.import=", "app.jwt-secret=weekly-report-test-only-secret-123456789", "app.cors-origin=http://localhost:3000"})
@Import(SecurityConfig.class)
class WeeklyLearningReportControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean WeeklyLearningReportService reports;
    @MockitoBean ParentAccountRepository accounts;
    final UUID id = UUID.randomUUID();

    @Test void unauthenticatedRequestIsRejected() throws Exception {
        mvc.perform(get("/api/students/{id}/reports/weekly-learning", id)).andExpect(status().isUnauthorized());
        verifyNoInteractions(reports);
    }
    @Test void jwtSubjectAndWeekArePassedToOwnershipCheckedService() throws Exception {
        LocalDate monday = LocalDate.of(2026, 10, 26);
        when(reports.get(id, "owner", monday)).thenReturn(new WeeklyLearningReportService.Report(
            monday, monday.plusDays(6), monday, 0, 0, null, null, false, 0, true, List.of(), List.of(), true));
        mvc.perform(get("/api/students/{id}/reports/weekly-learning", id).param("weekStart", monday.toString())
            .with(jwt().jwt(token -> token.subject("owner"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.uniqueQuestions").value(0))
            .andExpect(jsonPath("$.previousWeekUniqueQuestions").value(0))
            .andExpect(jsonPath("$.previousWeekActivityAvailable").value(true))
            .andExpect(jsonPath("$.reviewActivityAvailable").value(false));
        verify(reports).get(id, "owner", monday);
    }
    @Test void malformedDateIsBadRequest() throws Exception {
        mvc.perform(get("/api/students/{id}/reports/weekly-learning", id).param("weekStart", "wrong")
            .with(jwt())).andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }
}
