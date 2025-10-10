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
}

// Example code to know what tables were selected.
/*
function deleteSelected() {
  const selectedTables = document.querySelectorAll(".table-checkbox:checked");
  if (selectedTables.length === 0) {
    alert("No tables selected!");
    return;
  }

  selectedTables.forEach(cb => {
    cb.closest(".column").remove(); // remove the whole table column
  });

  alert(`${selectedTables.length} table(s) deleted.`);
}
*/