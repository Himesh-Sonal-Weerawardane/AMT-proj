// Class made by Himesh Sonal Weerawardane.
package backend;

/** Class that has most privileges within the of the system */
public class Admin extends User {
    private static final int ADMIN_PRIORITY = 1;

    public Admin(String name, String email, String department, String user_type) {
        super(name, email, department, user_type, ADMIN_PRIORITY);
    }

    private void createModule() {
        ;
    }

    private void publishModule() {
        ;
    }

    private void addMarkers() {
        ;
    }

    private void removeMarkers() {
        ;
    }

    private void viewStatistics() {
        ;
    }
}
