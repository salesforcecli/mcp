public class MultipleSOQLNoWhereClass {
    public List<Account> getAllAccounts() {
        return [SELECT Id, Name FROM Account];
    }

    public List<Contact> getAllContacts() {
        return [SELECT Id, FirstName, LastName, Email FROM Contact];
    }

    public List<Opportunity> getAllOpportunities() {
        return [SELECT Id, Name, Amount FROM Opportunity];
    }
}
