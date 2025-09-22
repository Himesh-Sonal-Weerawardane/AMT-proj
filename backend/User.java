// Class made by Himesh Sonal Weerawardane.
package backend;

/** Super class that handles User creation */
public class User {
    private String name;
    private String email;
    private String department;
    private String user_type;
    private int priority; // 0 for User, 1 for Admin

    public User(String name, String email, String department, String user_type, int priority) {
        this.name = name;
        this.email = email;
        this.department = department;
        this.user_type = user_type;
        this.priority = priority;
    }


}
