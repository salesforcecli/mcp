public class AllThreeAntipatterns {
    public void describeAndQuery() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        Schema.SObjectType accType = gd.get('Account');
        System.debug('Type: ' + accType);
    }

    public List<Opportunity> getOpportunities() {
        List<Opportunity> opps = [SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity];
        return opps;
    }

    public void reportAccounts() {
        List<Account> accounts = [SELECT Id, Name, Phone, Website, Industry, AnnualRevenue, NumberOfEmployees FROM Account WHERE IsDeleted = false LIMIT 200];
        for (Account acc : accounts) {
            System.debug('Processing: ' + acc.Name);
        }
    }
}
