import express from "express";

export default function authRoutes(supabase) {
	const router = express.Router();

	// Login endpoint
	router.post("/login", async (req, res) => {
		const { email, password } = req.body;

		// 1. Authenticate user via Supabase Auth
		const { data: authData, error: authError } =
			await supabase.auth.signInWithPassword({ email, password });
		if (authError) return res.status(400).json({ error: authError.message }); // User has wrong email/password

		const userId = authData.user.id;

		// 2. Check user role in the database
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("is_admin")
			.eq("auth_id", userId)
			.single();

		if (userError) return res.status(500).json({ error: userError.message }); // Server/Database failed

		// 3. Store cookie session info
		res.cookie("supabase_session", authData.session.access_token, {
			httpOnly: true,
			secure: true, // true in production HTTPS, false for testing
			// hours, mins, seconds, ms. 24*60*60*1000 = 1 day.
			maxAge: 24 * 60 * 60 * 1000,
		});

		// 3. Redirect to corresponding webpage and send a session token
		if (userData.is_admin) {
			res.json({ redirect: "/admin/front-page.html" });
		} else {
			res.json({ redirect: "/marker/front-page.html" });
		}
	});

	router.post("/is_loggedin", async (req, res) => {
		try {
			// Get token from cookie
			const token = req.cookies?.supabase_session;
			if (!token) return res.status(401).json({ error: "Not logged in" });

			// Get user from Supabase
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser(token);
			if (authError || !user)
				return res.status(401).json({ error: "Invalid session" });

			// Get role from database
			const { data: userData, error: userError } = await supabase
				.from("users")
				.select("is_admin")
				.eq("auth_id", user.id)
				.single();

			if (userError || !userData)
				return res.status(403).json({ error: "Access denied" });

			// Return info
			res.json({
				redirect: userData.is_admin
					? "/admin/front-page.html"
					: "/marker/front-page.html",
			});
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Server error" });
		}
	});

	// Logout
	router.post("/logout", async (req, res) => {
		try {
			await supabase.auth.signOut({ scope: "local" });

			// Clear the cookie
			res.clearCookie("supabase_session", {
				httpOnly: true,
				secure: true,
				path: "/",
			});

			res.status(200).json({ redirect: "/index.html", message: "Logged out" });
		} catch (error) {
			console.error("Error during logout: ", error);
			res.status(500).json({ message: "Failed to log out" });
		}
	});

	// Get session info like name, email, role.
	router.post("/user_info", async (req, res) => {
		try {
			// Get token from cookie
			const token = req.cookies?.supabase_session;
			if (!token) return res.status(401).json({ error: "Not logged in" });

			// Get user from Supabase
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser(token);
			if (authError || !user)
				return res.status(401).json({ error: "Invalid session" });

			// Get role from database
			const { data: userData, error: userError } = await supabase
				.from("users")
				.select("user_id, first_name, last_name, is_admin")
				.eq("auth_id", user.id)
				.single();

			if (userError || !userData)
				return res.status(403).json({ error: "Access denied" });

			// Return info
			res.json({
				user_id: userData.user_id,
				email: user.email,
				first_name: userData.first_name,
				last_name: userData.last_name,
				role: userData.is_admin ? "Admin" : "Marker",
			});
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Server error" });
		}
	});

	return router;
}
