// Check if a user is logged in and an admin. Otherwise, redirect to login page.
try {
    // If a user has logged in, they have a token
    const token = localStorage.getItem("supabase_session")
    if (!token) throw new Error("No token")

    const res = await fetch("/api/admin_session", {
        headers: { "Authorization": "Bearer " + token }
    })
    const data = await res.json()

    if (res.status !== 200) {
        // Not logged in or not admin -> redirect
        window.location.href = "/index.html"
    }

    // Everything is ok
    console.log("Name: ", data.name);
    console.log("Email: ", data.email);
    console.log("Role: ", data.is_admin ? "Admin" : "Marker");
} catch (err) {
    window.location.href = "/index.html"
}