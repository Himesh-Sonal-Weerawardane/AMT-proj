// Created by William Alexander Tang Wai on 21/10/2025

// Pop up: Confirm or Cancel action
function popUpConfirm(callback) {
    const modal = document.getElementById("moderationModal");
    const list = document.getElementById("moderationList");
    // Clear the old list
    list.innerHTML = "";

    const selectedTables = document.querySelectorAll(".table-checkbox:checked");
    if (selectedTables.length === 0) {
        // Nothing selected
        const p = document.createElement(`p`);
        p.textContent = `No Modules Selected...`;
        p.className = `selected-module-text`;
        list.appendChild(p);
    } else {
        // Module(s) selected
        let index = 0;
        selectedTables.forEach(checkbox => {
            const { year, semester, assignmentNum, moderationNum } = checkbox.dataset;
            const li = document.createElement("li");
            li.textContent = `${++index}. Year: ${year}, Semester: ${semester},
                                Assignment: ${assignmentNum}, Moderation: ${moderationNum}`;
            li.className = `selected-module-text`;
            list.appendChild(li);
        });
    }

    // Display the pop up
    modal.style.display = "flex";

    // Close the pop up
    document.getElementById("closeModal").onclick = () => {
        modal.style.display = "none";
    };

    // Confirm action to do
    document.getElementById("confirmSelected").onclick = () => {
        if (typeof callback === "function") callback(true);
    };
}