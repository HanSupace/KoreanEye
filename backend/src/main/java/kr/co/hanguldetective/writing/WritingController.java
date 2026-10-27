package kr.co.hanguldetective.writing;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class WritingController {
    private final WritingService writing;
    public WritingController(WritingService writing){this.writing=writing;}
    public record CreateWriting(@NotBlank String text){}
    public record Attempt(@NotBlank String answer){}
    @PostMapping("/api/writing-errors/{errorId}/review-complete") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void completeReview(@PathVariable UUID errorId,Principal p){writing.completeReview(errorId,p.getName());}
    @PostMapping("/api/students/{studentId}/writings") @ResponseStatus(HttpStatus.CREATED) public WritingService.WritingDto create(@PathVariable UUID studentId,@Valid @RequestBody CreateWriting body,Principal p){return writing.create(studentId,p.getName(),body.text());}
    @GetMapping("/api/students/{studentId}/writings") public List<WritingService.WritingDto> list(@PathVariable UUID studentId,Principal p){return writing.list(studentId,p.getName());}
    @GetMapping("/api/writings/{writingId}") public WritingService.WritingDto get(@PathVariable UUID writingId,Principal p){return writing.get(writingId,p.getName());}
    @PostMapping("/api/writing-errors/{errorId}/attempt") public WritingService.AttemptResult attempt(@PathVariable UUID errorId,@Valid @RequestBody Attempt body,Principal p){return writing.attempt(errorId,p.getName(),body.answer());}
    @PostMapping("/api/writing-errors/{errorId}/hint") public WritingService.HintResult hint(@PathVariable UUID errorId,Principal p){return writing.hint(errorId,p.getName());}
    @GetMapping("/api/students/{studentId}/weaknesses") public List<WritingService.WeaknessDto> weaknesses(@PathVariable UUID studentId,Principal p){return writing.weaknesses(studentId,p.getName());}
    @GetMapping("/api/students/{studentId}/reports/weekly") public WritingService.WeeklyDto weekly(@PathVariable UUID studentId,Principal p){return writing.weekly(studentId,p.getName());}
}
