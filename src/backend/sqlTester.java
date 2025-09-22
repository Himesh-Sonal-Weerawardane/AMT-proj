package backend;
import java.sql.*;

/** Class to check that the SQL connection works */
public class sqlTester {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/amt_db?serverTimezone=UTC";
        String username = "amt_user";
        String password = "amt_pass";

        try (Connection conn = DriverManager.getConnection(url, username, password)) {
            System.out.println("Connected to MySQL!");

            // Simple query to confirm
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT NOW()")) {
                if (rs.next()) {
                    System.out.println("Server time: " + rs.getString(1));
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
