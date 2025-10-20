// Submit publish module form
window.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("module-form")

    form.addEventListener("submit", async (e) => {
        e.preventDefault() // Prevent URL parameters from being added

        const year = document.getElementById("year").value
        const semester = document.getElementById("semester").value
        const assignmentNumber = document.getElementById("assignment-number").value
        const moderationNumber = document.getElementById("moderation-number").value
        const name = document.getElementById("module-title").value
        const moduleDeadline = document.getElementById("module-deadline").value
        const moduleDescription = document.getElementById("module-description").value
        const assignmentUpload = document.getElementById("assignment-upload").files[0]
        const rubricUpload = document.getElementById("rubric-upload").files[0]

        const now = new Date();
        const selectedDate = new Date(moduleDeadline);
        if (selectedDate <= now) {
            alert("Deadline must be in the future.");
            return;
        }

        if (!assignmentUpload) return alert("Please select an assignment to upload");
        if (!rubricUpload) return alert("Please select a rubric to upload")
        
        try {
            const formData = new FormData()
            formData.append("year", year)
            formData.append("semester", semester)
            formData.append("assignment_num", assignmentNumber)
            formData.append("moderation_num", moderationNumber)
            formData.append("name", name)
            formData.append("deadline_date", moduleDeadline)
            formData.append("description", moduleDescription)
            if (assignmentUpload) formData.append("assignment", assignmentUpload)
            if (rubricUpload) formData.append("rubric", rubricUpload)
            // Set upload_date in api

            const res = await fetch("/api/upload_module", {
                method: "POST",
                body: formData  // send multipart/form-data
            })
            const data = await res.json()

            if (res.status !== 200 || data.error) {
                console.error("Error publishing module:", data.error)
                alert("Error publishing module. Check console for details.")
                return
            } else {
                console.log("Successfully published module!")
                window.location.href = data.redirect
            }
        } catch (err) {
            console.error("Network or server error:", err)
        }
    })
})

// PDF preview only, docx cannot be previewed
function setupFilePreview(inputId, previewTitleId, previewObjectId, previewUnavailableId) {
    const input = document.getElementById(inputId)
    const previewTitle = document.getElementById(previewTitleId)
    const previewObject = document.getElementById(previewObjectId)
    const previewNotAvailableText = document.getElementById(previewUnavailableId)

    input.addEventListener('change', (e) => {
        const file = input.files[0]
        if (!file) {
            // No file selected — reset preview
            previewTitle.textContent = `Preview:`;
            previewObject.style.display = 'none';
            previewObject.data = '';
            previewNotAvailableText.style.display = "none";
        }

        // Update preview title
        previewTitle.textContent = `Preview: ${file.name}`

        // PDF preview if supported
        if (file.type === 'application/pdf') {
            previewObject.style.display = 'block'
            previewObject.data = URL.createObjectURL(file);
            previewNotAvailableText.style.display = "none"
        } else if (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            file.type === 'application/msword'
        ) {
            // Fallback for doc/docx, since it can't be displayed in the browser
            // Hide the object and show a manual message
            previewObject.style.display = 'none'
            previewObject.data = ''; // clear object data
            previewNotAvailableText.style.display = "flex"
        }
    });
}

// Setup previews for both assignment and rubric
setupFilePreview('assignment-upload', 'preview-assignment-title', 'preview-assignment-document', 'assignment-preview-unavailable-text')
setupFilePreview('rubric-upload', 'preview-rubric-title', 'preview-rubric-document', 'rubric-preview-unavailable-text')