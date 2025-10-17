// Submit login form
window.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form")

    form.addEventListener("submit", async (e) => {
        e.preventDefault() // Prevent URL parameters from being added

        const errorMessage = document.getElementById("error-message");
        errorMessage.style.display = "none"; // hide error

        const email = document.getElementById("email").value
        const password = document.getElementById("psw").value
        
        try {
            // Wait for login from server
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()

            if (data.error) {
                errorMessage.style.display = "block"; // show error
            } else {
                console.log("Successful login!")
                window.location.href = data.redirect
            }
        } catch (err) {
            console.error("Network or server error:", err)
        }
    })
})

// Check if a user is already logged in and if so, redirect to correct page
try {
    const token = localStorage.getItem("supabase_session")
    if (!token) exit

    const res = await fetch("/api/login_session", {
        headers: { "Authorization": "Bearer " + token }
    })
    const data = await res.json()

    if (res.status !== 200) {
        // Not logged in
        exit
    }

    // Otherwise, redirect
    window.location.href = data.redirect
    
} catch (err) {
    console.log("An error occurred: ", err)
}