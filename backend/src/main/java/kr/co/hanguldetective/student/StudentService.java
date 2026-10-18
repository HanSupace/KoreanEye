package kr.co.hanguldetective.student;

import kr.co.hanguldetective.auth.ParentAccount;
import kr.co.hanguldetective.auth.ParentAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class StudentService {
    private final StudentProfileRepository students; private final ParentAccountRepository accounts;
    public StudentService(StudentProfileRepository students, ParentAccountRepository accounts) { this.students=students;this.accounts=accounts; }
    public StudentProfile requireOwned(UUID id, String email) { return students.findByIdAndParentEmail(id,email).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"학생 정보를 찾을 수 없어요.")); }
    @Transactional(readOnly=true) public List<StudentDto> list(String email) { return students.findAllByParentEmailOrderByCreatedAt(email).stream().map(StudentDto::from).toList(); }
    @Transactional public StudentDto create(String email, String name, int grade, String nickname) {
        if(grade<1||grade>3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"학년은 1~3학년 중에서 골라 주세요.");
        ParentAccount parent=accounts.findByEmail(email).orElseThrow(); return StudentDto.from(students.save(new StudentProfile(parent,name.trim(),grade,nickname==null?null:nickname.trim())));
    }
    public record StudentDto(UUID id,String name,int grade,String nickname) { static StudentDto from(StudentProfile s) { return new StudentDto(s.getId(),s.getName(),s.getGrade(),s.getNickname()); } }
}
