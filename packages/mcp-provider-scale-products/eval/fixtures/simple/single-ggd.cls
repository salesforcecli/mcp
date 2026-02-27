public class SingleGGDClass {
    public void describeObjects() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        Schema.SObjectType accountType = gd.get('Account');
        System.debug('Account type: ' + accountType);
    }
}
