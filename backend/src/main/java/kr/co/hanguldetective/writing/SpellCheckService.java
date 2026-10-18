package kr.co.hanguldetective.writing;
import java.util.List;
public interface SpellCheckService {
    AnalysisResult analyze(String text);
    record AnalysisResult(List<DetectedError> errors, String provider) {}
    record DetectedError(String original,String correct,int startIndex,int endIndex,String category,String explanation,String hintLevel1,String hintLevel2,List<String> choices) {}
}
