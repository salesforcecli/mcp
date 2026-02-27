public class MultipleGGDClass {
    public void describeAccount() {
        Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get('Account').getDescribe();
        System.debug('Account label: ' + dsr.getLabel());
    }

    public void describeContact() {
        Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get('Contact').getDescribe();
        System.debug('Contact label: ' + dsr.getLabel());
    }

    public Boolean objectExists(String objectName) {
        return Schema.getGlobalDescribe().containsKey(objectName);
    }
}
