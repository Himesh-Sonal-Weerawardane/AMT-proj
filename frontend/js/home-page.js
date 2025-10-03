// Created by William Alexander Tang Wai on 16/09/2025 */
// Collapsibles/Accordion Tutorial on https://www.w3schools.com/howto/howto_js_accordion.asp

var accordion = document.getElementsByClassName("accordion");
var accordion1 = document.getElementsByClassName("accordion1");
toggleAccordion(accordion);
toggleAccordion(accordion1);

/**
 * Toggles (opens/closes) the accordions.
 */
function toggleAccordion(acc) {
    for (var i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            /* Toggle between adding and removing the "active" class,
            to highlight the button that controls the panel */
            this.classList.toggle("active");

            /* Toggle between hiding and showing the active panel */
            var panel = this.nextElementSibling;
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else {
                panel.style.display = "block";
            }
        });
    }
}

/* Profile panel toggle */
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