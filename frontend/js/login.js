window.addEventListener("DOMContentLoaded", () => {
	initLogin();
});

async function initLogin() {
	// Check if a user is already logged in
	try {
		const res = await fetch("/api/is_loggedin", { method: "POST" });
		const data = await res.json();
		if (res.status === 200) {
			window.location.href = data.redirect;
		} else {
			console.log("Error: Something went wrong");
		}
	} catch (err) {
		console.log("An error occurred: ", err);
	}

	// Login form
	const form = document.getElementById("login-form");
	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const errorMessage = document.getElementById("error-message");
		errorMessage.style.display = "none";

		const email = document.getElementById("email").value;
		const password = document.getElementById("psw").value;

		try {
			const res = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			const data = await res.json();

			if (data.error) {
				errorMessage.style.display = "block";
			} else {
				console.log("Successful login!");
				window.location.href = data.redirect;
			}
		} catch (err) {
			console.error("Network or server error:", err);
		}
	});
}
