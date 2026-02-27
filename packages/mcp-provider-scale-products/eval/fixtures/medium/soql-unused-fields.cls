public class SOQLUnusedFieldsClass {
    public void processAccounts() {
        List<Account> accounts = [SELECT Id, Name, BillingCity, BillingState, Phone, Industry, AnnualRevenue FROM Account WHERE Id != null LIMIT 100];
        for (Account acc : accounts) {
            System.debug('Account name: ' + acc.Name);
            System.debug('Account city: ' + acc.BillingCity);
        }
    }
}
