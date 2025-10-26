// Created by William Alexander Tang Wai on 16/09/2025 */
// Collapsibles/Accordion Tutorial on https://www.w3schools.com/howto/howto_js_accordion.asp

/**
 * Toggles (opens/closes) the accordions.
 */
function toggleAccordion(acc) {
  for (var i = 0; i < acc.length; i++) {
    // Make accordion open by default
    // Can update this to make only the current year/sem open by default if needed
    acc[i].classList.add("active");
    var panel = acc[i].nextElementSibling;
    if (panel) panel.style.display = "block";

    acc[i].addEventListener("click", function () {
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
