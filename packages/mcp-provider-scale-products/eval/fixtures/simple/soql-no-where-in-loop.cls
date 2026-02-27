public class SOQLNoWhereInLoopClass {
    public void processAllObjects() {
        List<String> objectNames = new List<String>{'Account', 'Contact', 'Opportunity'};
        for (String objName : objectNames) {
            List<Account> accounts = [SELECT Id, Name FROM Account];
            System.debug('Found ' + accounts.size() + ' accounts for ' + objName);
        }
    }
}
