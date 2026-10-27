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
        new Rule(Pattern.compile("되요"),"돼요","DOE_DWAE","‘되어요’로 바꿀 수 있는지 살펴봐요.","‘되어요’로 바꿔 말해 보세요.","‘되어요’를 줄이면 두 글자가 돼요.",List.of("되요","돼요","되어요")),
        common("됬", "됐", "DOE_DWAE", "‘되었’을 줄인 표현인지 생각해 보세요."),
        common("오랫만", "오랜만", "PRONUNCIATION_SPELLING", "‘오래간만’을 줄인 말이에요."),
        common("웬지", "왠지", "PRONUNCIATION_SPELLING", "‘왜인지’를 줄인 말이에요."),
        common("몇일", "며칠", "PRONUNCIATION_SPELLING", "날짜나 날의 수를 나타내는 말이에요."),
        common("설겆이", "설거지", "PRONUNCIATION_SPELLING", "그릇을 깨끗하게 씻는 일을 떠올려 보세요."),
        common("어의없", "어이없", "PRONUNCIATION_SPELLING", "너무 뜻밖이라 말이 나오지 않는 상황이에요."),
        common("어떻해", "어떡해", "PRONUNCIATION_SPELLING", "‘어떻게 해’를 줄인 말이에요."),
        common("사당해요", "사랑해요", "CHARACTER_CONFUSION", "좋아하는 마음을 전하는 표현인지 생각해 보세요.")
    );
    private static Rule common(String original,String correct,String category,String hint) {
        return new Rule(Pattern.compile(Pattern.quote(original)),correct,category,"표준어 표기를 확인해 보세요.",hint,"소리와 글자의 모양을 나누어 생각해 보세요.",List.of(original,correct));
    }
    public SpellCheckService.AnalysisResult analyze(String text){
        List<SpellCheckService.DetectedError> found=new ArrayList<>();
        for(Rule r:rules){Matcher m=r.pattern.matcher(text);while(m.find())found.add(new SpellCheckService.DetectedError(m.group(),r.correct,m.start(),m.end(),r.category,r.explanation,r.hint1,r.hint2,r.choices));}
        found.sort(Comparator.comparingInt(SpellCheckService.DetectedError::startIndex));
        return new SpellCheckService.AnalysisResult(found,"rules");
    }
}
