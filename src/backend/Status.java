// Class made by Himesh Sonal Weerawardane.
package backend;

public enum Status {
    COMPLETED("Completed"),
    IN_PROGRESS("In Progress"),
    LATE("Late"),
    UNCONFIRMED("Unconfirmed");

    private final String displayName;

    Status(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static Status fromString(String value) {
        for (Status status : Status.values()) {
            if (status.displayName.equalsIgnoreCase(value) ||
                    status.name().equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }
}
