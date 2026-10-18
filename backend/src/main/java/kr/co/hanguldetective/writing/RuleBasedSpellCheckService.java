package kr.co.hanguldetective.writing;

import java.util.*;
import java.util.regex.*;
import org.springframework.stereotype.Service;

@Service
public class RuleBasedSpellCheckService {
    private record Rule(Pattern pattern,String correct,String category,String explanation,String hint1,String hint2,List<String> choices){}
    private final List<Rule> rules=List.of(
        new Rule(Pattern.compile("가치(?=\\s*놀)"),"같이","PRONUNCIATION_SPELLING","‘함께’라는 뜻의 말이에요.","친구와 무엇을 했나요? ‘함께’라는 뜻이에요.","‘같’으로 시작해요.",List.of("가치","같이","갇이")),
        new Rule(Pattern.compile("집에와서"),"집에 와서","SPACING","장소를 나타내는 말 뒤를 띄어 써요.","‘집에’와 ‘와서’를 나누어 생각해 보세요.","‘집에’ 뒤를 한 칸 띄워요.",List.of("집에와서","집에 와서","집에 와 써")),
        new Rule(Pattern.compile("학교에갔다"),"학교에 갔다","SPACING","장소와 행동을 나타내는 말을 띄어 써요.","‘학교에’와 ‘갔다’를 나누어 보세요.","가운데 한 칸을 띄워요.",List.of("학교에갔다","학교에 갔다","학교 에갔다")),
        new Rule(Pattern.compile("되요"),"돼요","DOE_DWAE","‘되어요’로 바꿀 수 있는지 살펴봐요.","‘되어요’로 바꿔 말해 보세요.","‘되어요’를 줄이면 두 글자가 돼요.",List.of("되요","돼요","됬요"))
    );
    public SpellCheckService.AnalysisResult analyze(String text){
        List<SpellCheckService.DetectedError> found=new ArrayList<>();
        for(Rule r:rules){Matcher m=r.pattern.matcher(text);while(m.find())found.add(new SpellCheckService.DetectedError(m.group(),r.correct,m.start(),m.end(),r.category,r.explanation,r.hint1,r.hint2,r.choices));}
        found.sort(Comparator.comparingInt(SpellCheckService.DetectedError::startIndex));
        return new SpellCheckService.AnalysisResult(found,"rules");
    }
}
