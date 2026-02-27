public class CleanClass {
    public Account getAccountById(Id accountId) {
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id = :accountId LIMIT 1];
        if (!accounts.isEmpty()) {
            return accounts[0];
        }
        return null;
    }

    public void updateAccountName(Id accountId, String newName) {
        Account acc = [SELECT Id, Name FROM Account WHERE Id = :accountId LIMIT 1];
        acc.Name = newName;
        update acc;
    }
}
