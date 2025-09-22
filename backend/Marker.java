// Class made by Himesh Sonal Weerawardane.
package backend;

/** Marker Class with marker responsibilities and specifics */
public class Marker extends User {
    private boolean hasCompletedModeration1 = false;
    private boolean hasCompletedModeration2 = false;
    private String userStatus;
    private static final int MARKER_PRIORITY = 0;

    public Marker(String name, String email, String department, String user_type) {
        super(name, email, department, user_type, MARKER_PRIORITY);
    }
}
