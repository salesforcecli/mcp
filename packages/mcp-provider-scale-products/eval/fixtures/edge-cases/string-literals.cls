public class StringLiteralsClass {
    public void logMessages() {
        String warning1 = 'Do not use Schema.getGlobalDescribe() in production code';
        String warning2 = 'Avoid queries like SELECT Id FROM Account without WHERE';
        System.debug(warning1);
        System.debug(warning2);
    }

    public String getAdvice() {
        return 'Remember to add LIMIT to your SOQL queries';
    }
}
