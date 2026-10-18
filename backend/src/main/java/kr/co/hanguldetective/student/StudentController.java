package kr.co.hanguldetective.student;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/students")
public class StudentController {
    private final StudentService students;
    public StudentController(StudentService students) { this.students=students; }
    public record CreateStudent(@NotBlank @Size(max=40) String name,@Min(1) @Max(3) int grade,@Size(max=40) String nickname) {}
    @GetMapping public List<StudentService.StudentDto> list(Principal principal) { return students.list(principal.getName()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public StudentService.StudentDto create(Principal principal,@Valid @RequestBody CreateStudent body) { return students.create(principal.getName(),body.name(),body.grade(),body.nickname()); }
}
