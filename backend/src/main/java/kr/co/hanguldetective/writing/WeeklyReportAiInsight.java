package kr.co.hanguldetective.writing;

public record WeeklyReportAiInsight(String praise, String nextGoal, String weaknessSummary, String parentAdvice) {
    public WeeklyReportAiInsight(String praise, String nextGoal) {
        this(praise, nextGoal, "", "");
    }
}
