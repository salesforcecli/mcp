public class ApexTarget2 {


    public static boolean doSomething() {
        Integer i = 0;
        for (i = 0; i < 10; i++) {
            Account[] accs = [SELECT Name FROM Account WITH SYSTEM_MODE];
        }
        return false;
    }
}