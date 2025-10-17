// Check if a user is logged in and an admin. Otherwise, redirect to login page.
try {
    // If a user has logged in, they have a token
    const token = localStorage.getItem("supabase_session")
    if (!token) throw new Error("No token")

    const res = await fetch("/api/login_session", {
        headers: { "Authorization": "Bearer " + token }
    })
    const data = await res.json()

    if (res.status !== 200) {
        // Not logged in or not admin -> redirect
        window.location.href = "/index.html"
    }

    // Everything is ok
    console.log("Name: ", data.name)
    console.log("Email: ", data.email)
    console.log("Role: ", data.is_admin ? "Admin" : "Marker")

    // Profile and privacy pages only
    setProfilePrivacyPages(data)
    
} catch (err) {
    window.location.href = "/index.html"
}

function setProfilePrivacyPages(data) {
    // Update elements only if they exist on this page
    const roleEl = document.getElementById("profile-role")
    if (roleEl) roleEl.textContent = data.is_admin ? "Admin" : "Marker"

    const firstNameEl = document.getElementById("profile-first-name")
    if (firstNameEl) firstNameEl.textContent = data.name

    const lastNameEl = document.getElementById("profile-last-name")
    if (lastNameEl) lastNameEl.textContent = data.name

    const emailEl = document.getElementById("profile-email-text")
    if (emailEl) emailEl.textContent = data.email

    const profileTextEl = document.getElementById("profile-text")
    if (profileTextEl && data.name) {
        const initials = data.name.split(" ").map(n => n[0]).join("").toUpperCase()
        profileTextEl.textContent = initials
    }
}