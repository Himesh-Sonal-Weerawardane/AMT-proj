/* Profile panel toggle */
window.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    navbarInfo();
})

function initNavbar() {
    document.getElementById("navbar-container").innerHTML = navbarHTML;

    var profileButton = document.querySelector(".profile-button");
    var profilePanel = document.getElementById("profile-panel");

    if (profileButton && profilePanel) {
        profileButton.addEventListener("click", function(event) {
            event.stopPropagation();
            var isVisible = profilePanel.classList.toggle("is-visible");
            profileButton.setAttribute("aria-expanded", isVisible);
        });

        document.addEventListener("click", function(event) {
            if (!profilePanel.contains(event.target) && profilePanel.classList.contains("is-visible")) {
                profilePanel.classList.remove("is-visible");
                profileButton.setAttribute("aria-expanded", false);
            }
        });

        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape" && profilePanel.classList.contains("is-visible")) {
                profilePanel.classList.remove("is-visible");
                profileButton.setAttribute("aria-expanded", false);
            }
        });
    }

    document.getElementById("sign-out-button").addEventListener("click", signOut);
}

async function signOut() {
    try {
        const res = await fetch("/api/logout", {
            method: "POST"
        })
        const data = await res.json()

        if (res.status !== 200) {
            // Error logging out
            console.log("Could not log out!")
            return;
        }

        // Logged out, redirect to login page
        console.log(data.message)
        window.location.href = data.redirect
    } catch (err) {
        console.error("Network or server error:", err)
    }
}

async function navbarInfo() {
    try {
        // fetch user data: first_name, last_name, email, role from server
        const res = await fetch("/api/user_info", { method: "POST" });
        const data = await res.json();

        if (res.status !== 200) {
            console.log("Could not fetch user data!")
            return;
        }
        console.log("User data has been fetched")

        // Change profile info to fetched info
        const firstInitial = data.first_name ? data.first_name[0] : "";
        const lastInitial = data.last_name ? data.last_name[0] : "";
        document.getElementById("button-first-last-name-initials").textContent = firstInitial + lastInitial;
        document.getElementById("first-last-name-initials-text").textContent = firstInitial + lastInitial;
        document.getElementById("profile-panel-first-last-name-text").textContent = data.first_name + " " + data.last_name
        document.getElementById("profile-panel-email-text").textContent = data.email

        // Add links to navbar depending on the role of the user
        if (data.role == "Admin") {
            document.getElementById("home-link").href = "/admin/front-page.html"
            document.getElementById("assignment-modules-link").href = "/admin/moderation-frontpage.html"
            document.getElementById("contact-help-link").href = "/admin/contact-help-page.html"
            document.getElementById("information-handbook-link").href = "/admin/info-handbook-page.html"
        } else {
            document.getElementById("home-link").href = "/marker/front-page.html"
            document.getElementById("assignment-modules-link").href = "/marker/moderation-frontpage.html"
            document.getElementById("contact-help-link").href = "/marker/contact-help-page.html"
            document.getElementById("information-handbook-link").href = "/marker/info-handbook-page.html"
        }

    } catch (err) {
        console.log("An error occurred: ", err);
    }
}

const navbarHTML = `
<header class="top-navigation" role="banner">
    <div class="nav-left">
        <span class="nav-brand">AMT</span>
        <span class="nav-course" aria-label="Current course">ASP228?</span>
    </div>

    <!-- To change the links -->
    <!-- If admin, add another link to staff-listings -->
    <nav class="nav-links" aria-label="Primary">
        <a id="home-link" class="nav-link is-active" href=#>Home</a>
        <a id="assignment-modules-link" class="nav-link" href=#>Assignment Modules</a>
        <a id="contact-help-link" class="nav-link" href=#>Contact and Help</a>
        <a id="information-handbook-link" class="nav-link" href=#>Information and Handbook</a>
    </nav>

    <div class="nav-actions">
        <button class="icon-button profile-button" type="button" aria-label="Open profile" aria-haspopup="true" aria-expanded="false" aria-controls="profile-panel">
            <span id="button-first-last-name-initials" aria-hidden="true">...</span>
        </button>
        <div class="profile-panel" id="profile-panel" role="dialog" aria-label="Profile">
            <div class="profile-panel-body">
                <div id="first-last-name-initials-text" class="profile-panel-avatar" aria-hidden="true">...</div>
                <p id="profile-panel-first-last-name-text" class="profile-panel-name">...</p>
                <p id="profile-panel-email-text" class="profile-panel-email">...</p>
            </div>
            <div class="profile-panel-links">
                <a class="profile-panel-link" href="settings-page-profile.html">
                        <span class="profile-panel-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
                                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.35 0-8 2.24-8 5v1h16v-1c0-2.76-3.65-5-8-5z" />
                            </svg>
                        </span>
                    <span class="profile-panel-link-label">Profile</span>
                </a>
                <a class="profile-panel-link" href="settings-page-privacy.html">
                        <span class="profile-panel-icon is-square" aria-hidden="true">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false">
                                <path d="M8 7V6a4 4 0 0 1 8 0v1h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm2-1a2 2 0 1 1 4 0v1h-4zm8 4H6v8h12z" />
                            </svg>
                        </span>
                    <span class="profile-panel-link-label">Privacy</span>
                </a>
            </div>
            <button id="sign-out-button" class="profile-panel-link">
                <span>Sign out</span>
            </button>
        </div>
    </div>
</header>
`;