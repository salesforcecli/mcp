public class GGDInLoopClass {
    public void processObjects(List<String> objectNames) {
        for (String objectName : objectNames) {
            Schema.DescribeSObjectResult dsr = Schema.getGlobalDescribe().get(objectName).getDescribe();
            System.debug('Object ' + objectName + ' label: ' + dsr.getLabel());
        }
    }
}
