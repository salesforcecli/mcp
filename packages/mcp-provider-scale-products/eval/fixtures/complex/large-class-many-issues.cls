public class LargeClassManyIssues {

    // --- GGD antipatterns ---

    public void describeAllObjects() {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        for (String key : gd.keySet()) {
            System.debug('Object: ' + key);
        }
    }

    public Boolean isCustomObject(String objectName) {
        return Schema.getGlobalDescribe().containsKey(objectName);
    }

    // --- SOQL without WHERE or LIMIT ---

    public List<Account> getAllAccounts() {
        return [SELECT Id, Name, Industry FROM Account];
    }

    public List<Contact> getAllContacts() {
        return [SELECT Id, FirstName, LastName, Email FROM Contact];
    }

    // --- SOQL unused fields ---

    public void summarizeOpportunities() {
        List<Opportunity> opps = [SELECT Id, Name, Amount, StageName, CloseDate, Probability, Type
                                  FROM Opportunity
                                  WHERE StageName != 'Closed Won'
                                  LIMIT 500];
        Decimal totalAmount = 0;
        for (Opportunity opp : opps) {
            totalAmount += opp.Amount != null ? opp.Amount : 0;
            System.debug('Opportunity: ' + opp.Name);
        }
        System.debug('Total pipeline: ' + totalAmount);
    }

    // --- Clean methods (no antipatterns) ---

    public Account getAccountById(Id accountId) {
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id = :accountId LIMIT 1];
        return accounts.isEmpty() ? null : accounts[0];
    }

    public Integer countLeads() {
        return [SELECT COUNT() FROM Lead WHERE Status = 'Open'];
    }
}
