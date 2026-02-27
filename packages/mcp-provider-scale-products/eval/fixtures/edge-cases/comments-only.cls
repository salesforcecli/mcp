public class CommentsOnlyClass {
    /**
     * This method does NOT call Schema.getGlobalDescribe().
     * The reference to getGlobalDescribe is only in this comment.
     *
     * Example of what NOT to do:
     * Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
     *
     * Also note: [SELECT Id, Name FROM Account] without WHERE is bad,
     * but this is just a comment, not real code.
     */
    public void safeMethod() {
        // Schema.getGlobalDescribe() - this is a comment, not a call
        // [SELECT Id FROM Contact] - also just a comment
        String message = 'This class is clean';
        System.debug(message);
    }
}
