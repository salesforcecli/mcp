public class SOQLWithWhereNoLimitClass {
    public List<Account> getActiveAccounts() {
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE IsDeleted = false];
        return accounts;
    }

    public List<Contact> getContactsByAccount(Id accountId) {
        List<Contact> contacts = [SELECT Id, FirstName, LastName FROM Contact WHERE AccountId = :accountId];
        return contacts;
    }
}
