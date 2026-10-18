package kr.co.hanguldetective.config;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<Map<String,String>> status(ResponseStatusException ex){return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message",ex.getReason()==null?"요청을 처리하지 못했어요.":ex.getReason()));}
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Map<String,String>> invalid(MethodArgumentNotValidException ex){String message=ex.getBindingResult().getFieldErrors().stream().findFirst().map(e->e.getField()+" 입력을 확인해 주세요.").orElse("입력값을 확인해 주세요.");return ResponseEntity.badRequest().body(Map.of("message",message));}
    @ExceptionHandler(Exception.class) ResponseEntity<Map<String,String>> unexpected(Exception ex){return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message","서버에서 요청을 처리하지 못했어요."));}
}
