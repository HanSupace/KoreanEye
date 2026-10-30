package kr.co.hanguldetective.learning;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HintGuideTest {
    @Test void firstTwoHintsDoNotRevealFullAnswerOrChoices() {
        for(int level=1;level<=2;level++) {
            var hint=HintGuide.create("VOCABULARY","강아지","강아지는 동물이에요.",List.of("강아지","고양이"),level);
            assertFalse(hint.hint().contains("강아지"));
            assertTrue(hint.choices().isEmpty());
        }
        assertTrue(HintGuide.create("VOCABULARY","강아지",null,List.of(),2).hint().contains("ㄱㅇㅈ"));
    }
    @Test void finalHintIncludesAnswerOnceAndStableChoices() {
        var hint=HintGuide.create("DOE_DWAE","돼요",null,List.of("돼요","되요","돼요"),3);
        assertEquals(3,hint.level());
        assertEquals(2,hint.choices().size());
        assertTrue(hint.choices().contains("돼요"));
        assertEquals(hint,HintGuide.create("DOE_DWAE","돼요",null,List.of("돼요","되요","돼요"),4));
    }
    @Test void decomposedHangulAndSpacesProduceCorrectLetterCount() {
        var hint=HintGuide.create("SPACING",java.text.Normalizer.normalize("집에 와서",java.text.Normalizer.Form.NFD),null,List.of(),2);
        assertTrue(hint.hint().contains("4글자"));
        assertTrue(hint.hint().contains("ㅈㅇ ㅇㅅ"));
    }
}
