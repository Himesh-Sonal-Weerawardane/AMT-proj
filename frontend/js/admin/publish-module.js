// Created by William Alexander Tang Wai on 21/10/2025

// Publish Module (Make it available to markers)
// Module must be marked first
async function publishModule() {
    popUpConfirm(async (isConfirmed) => {
        // Action canceled
        if (!isConfirmed) return;

        // Publish selected Modules
        const selectedTables = document.querySelectorAll(".table-checkbox:checked");
        if (selectedTables.length === 0) {
            alert(`Select a Module first!`);
            // Close pop up
            document.getElementById("moderationModal").style.display = "none";
            return;
        }

        const modulesToDelete = Array.from(selectedTables).map(checkbox => ({
            year: checkbox.dataset.year,
            semester: checkbox.dataset.semester,
            assignmentNum: checkbox.dataset.assignmentNum,
            moderationNum: checkbox.dataset.moderationNum
        }));

        // Send all together
        const res = await fetch("/api/delete-modules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modules: modulesToDelete })
        });

        const data = await res.json();

        if (res.status !== 200 || data.error) {
            alert(`Error Publishing Module(s): ${data.error}`)
            return
        } else {
            // Return which module(s) were successful and which failed

            alert("Successfully published module(s)!")
            // Refresh the page
            window.location.reload(true);
        }

        // Module(s) selected
        const messages = Array.from(selectedTables).map(checkbox => {
            const { year, semester, assignmentNum, moderationNum } = checkbox.dataset;
            return `• Year: ${year}, Semester: ${semester}, Assignment: ${assignmentNum}, Moderation: ${moderationNum}`;
        });
        alert("Deleted Modules:\n\n" + messages.join("\n"));

        
    })
}