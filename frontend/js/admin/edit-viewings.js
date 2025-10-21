// Created by William Alexander Tang Wai on 09/10/2025

let editMode = false;

function toggleEditViewings() {
    editMode = !editMode; // Toggle between ON and OFF

    // Get all checkboxes and toggle their visibility
    const checkboxes = document.querySelectorAll('.table-checkbox');
    checkboxes.forEach(cb => {
        if (editMode) {
            cb.style.display = "inline-flex";
        } else {
            cb.checked = false;
            cb.style.display = "none";
        }
    });

    // Get the buttons to display/hide and toggle their visibility
    const topButtonsContainer = document.getElementById('top-buttons-container');
    topButtonsContainer.style.display = editMode ? "none" : "flex";
    
    const footer = document.querySelector('.page-footer');
    footer.style.display = editMode ? "flex" : "none";

    // Close pop up
    if (!editMode) {
        document.getElementById("moderationModal").style.display = "none";
    }
}