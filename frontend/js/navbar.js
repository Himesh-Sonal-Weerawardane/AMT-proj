/* Profile panel toggle */
window.addEventListener("DOMContentLoaded", () => {
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
})

const navbarHTML = `
<header class="top-navigation" role="banner">
    <div class="nav-left">
        <button class="icon-button menu-button" type="button" aria-label="Open navigation">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="14" height="2" rx="1" />
                <rect x="3" y="9" width="14" height="2" rx="1" />
                <rect x="3" y="13" width="14" height="2" rx="1" />
            </svg>
        </button>
        <span class="nav-brand">AMT</span>
        <span class="nav-course" aria-label="Current course">ASP228?</span>
    </div>

    <!-- To change the links -->
    <nav class="nav-links" aria-label="Primary">
        <a class="nav-link is-active" href="admin/front-page.html">Home</a>
        <a class="nav-link" href="marker/moderation-frontpage.html">Assignment Modules</a>
        <a class="nav-link" href="contact-help-page.html">Contact and Help</a>
        <a class="nav-link" href="info-handbook-page.html">Information and Handbook</a>
        <a class="nav-link" href="settings-page-profile.html">Settings</a>
    </nav>

    <div class="nav-actions">
        <button class="icon-button search-button" type="button" aria-label="Search">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0-2a9 9 0 1 0 5.66 15.89l3.72 3.73a1 1 0 0 0 1.41-1.42l-3.72-3.72A9 9 0 0 0 11 2z" />
            </svg>
        </button>
        <button class="icon-button profile-button" type="button" aria-label="Open profile" aria-haspopup="true" aria-expanded="false" aria-controls="profile-panel">
            <span aria-hidden="true">C</span>
        </button>
        <div class="profile-panel" id="profile-panel" role="dialog" aria-label="Profile">
            <div class="profile-panel-body">
                <div class="profile-panel-avatar" aria-hidden="true">C</div>
                <p class="profile-panel-name">Carrie Deakin</p>
                <p class="profile-panel-email">carriedeakin@deakin.com</p>
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
        </div>
    </div>
</header>
`;