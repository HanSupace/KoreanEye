package kr.co.hanguldetective.writing;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RuleBasedSpellCheckServiceTest {
    final RuleBasedSpellCheckService service=new RuleBasedSpellCheckService();
    @Test void reportedCorrectSentencesHaveNoErrors() {
        for(String text:java.util.List.of("시험이 빨리 끝났으면 좋겠다.","오늘 학교에 다녀왔다.","친구와 함께 밥을 먹었다.","나는 책을 읽고 잠들었다."))
            assertTrue(service.analyze(text).errors().isEmpty(),text);
    }
    @Test void reportedSpellingAndSpacingErrorsRemainDetectable() {
        var cases=java.util.Map.of("시험이 빨리 끝낫으면 좋겠다.","끝났으면","오늘 친구랑 가치 놀았다.","같이","집에와서 밥을 먹었다.","집에 와서");
        cases.forEach((text,correct)->assertTrue(service.analyze(text).errors().stream().anyMatch(error->correct.equals(error.correct())),text));
    }
    @Test void detectsCommonMisspellingsWithExactOriginalOffsets() {
        String text="오랫만에 만나서 사당해요. 설겆이를 했는데 잘 안되요. 숙제를 다 했다고 해도 됬어요.";
        var result=service.analyze(text);
        assertEquals(5,result.errors().size());
        assertTrue(result.errors().stream().anyMatch(error->error.correct().equals("사랑해요")));
        for(var error:result.errors()) assertEquals(error.original(),text.substring(error.startIndex(),error.endIndex()));
    }
    @Test void leavesCorrectTextAndContextualHomonymAlone() {
        assertTrue(service.analyze("오랜만에 친구와 같이 놀았다. 사랑해요. 이 물건의 가치를 알아요.").errors().isEmpty());
    }
}
