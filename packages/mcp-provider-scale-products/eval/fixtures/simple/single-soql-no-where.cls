public class SingleSOQLNoWhereClass {
    public List<Account> getAllAccounts() {
        List<Account> accounts = [SELECT Id, Name FROM Account];
        return accounts;
    }
}
