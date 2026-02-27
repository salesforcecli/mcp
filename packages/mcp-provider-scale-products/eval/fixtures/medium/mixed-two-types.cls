public class MixedTwoTypesClass {
    public void checkObjectType(String objectName) {
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        if (gd.containsKey(objectName)) {
            System.debug(objectName + ' exists');
        }
    }

    public List<Contact> getContacts() {
        List<Contact> contacts = [SELECT Id, FirstName, LastName, Email FROM Contact];
        return contacts;
    }
}
