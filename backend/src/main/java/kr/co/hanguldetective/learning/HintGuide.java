package kr.co.hanguldetective.learning;

import java.text.Normalizer;
import java.util.List;
import java.util.stream.Stream;

/** Deterministic hints: no model call and no full answer before the choices stage. */
public final class HintGuide {
    private HintGuide() {}
    public record Result(int level, String hint, List<String> choices) {}
    public static Result create(String category, String answer, String explanation, List<String> options, int requestedLevel) {
        int level=Math.max(1,Math.min(3,requestedLevel));
        String correct=Normalizer.normalize(answer,Normalizer.Form.NFC);
        if(level==3) {
            List<String> choices=Stream.concat(options.stream(),Stream.of(correct)).filter(value->value!=null&&!value.isBlank()).distinct().sorted().toList();
            return new Result(3,"보기를 비교한 뒤, 답을 직접 써보세요.",choices);
        }
        if(level==1) {
            String hint=switch(category) {
                case "SPACING" -> "뜻이 이어지는 낱말을 찾아보고, 낱말 사이를 어디에서 띌지 생각해 보세요.";
                case "FINAL_CONSONANT" -> "소리만 따라 쓰지 말고, 글자 아래에 들어갈 받침을 생각해 보세요.";
                case "DOE_DWAE" -> "문장에 ‘되어’를 넣어 읽었을 때 자연스러운지 생각해 보세요.";
                case "AN_ANH" -> "뒤에 동사가 바로 오는지, ‘-지’ 뒤에 이어지는 말인지 살펴보세요.";
                case "VOCABULARY" -> "소리를 다시 듣고, 첫소리와 끝소리를 나누어 생각해 보세요.";
                default -> "문장 전체를 천천히 읽고, 소리와 글자 모양을 나누어 생각해 보세요.";
            };
            if("VOCABULARY".equals(category)&&explanation!=null&&!explanation.isBlank()&&!Normalizer.normalize(explanation,Normalizer.Form.NFC).contains(correct)) hint=explanation;
            return new Result(1,correct.isEmpty()?hint:hint.replace(correct,"□"),List.of());
        }
        StringBuilder initials=new StringBuilder();
        String consonants="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
        correct.codePoints().forEach(cp->{
            if(Character.isWhitespace(cp)) initials.append(' ');
            else if(cp>=0xAC00&&cp<=0xD7A3) initials.append(consonants.charAt((cp-0xAC00)/588));
            else initials.append('□');
        });
        long count=correct.codePoints().filter(cp->!Character.isWhitespace(cp)).count();
        String clue="띄어쓰기를 제외하고 "+count+"글자예요. 초성 단서: "+initials;
        return new Result(2,clue,List.of());
    }
}
