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

                // Store login session to check on other pages
                localStorage.setItem("supabase_session", data.access_token)
            }
        } catch (err) {
            console.error("Network or server error:", err)
        }
    })
})