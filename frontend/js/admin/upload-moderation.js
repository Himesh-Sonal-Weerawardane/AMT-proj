// Submit publish module form
window.addEventListener("DOMContentLoaded", () => {
    const cleanupObjectUrl = (card) => {
        const objectHolder = card.__objectUrl
        if (objectHolder) {
            URL.revokeObjectURL(objectHolder)
            card.__objectUrl = null
        }
    }

    const uploadCards = document.querySelectorAll("[data-upload-card]")
    uploadCards.forEach((card) => {
        const input = card.querySelector("[data-upload-input]")
        const placeholder = card.querySelector("[data-placeholder]")
        const preview = card.querySelector("[data-preview]")
        const fileNameEl = card.querySelector("[data-file-name]")
        const objectEl = card.querySelector("[data-preview-object]")
        const fallbackMessage = card.querySelector("[data-fallback]")
        const fallbackDefaultMessage = fallbackMessage?.dataset.defaultMessage ?? ""

        input.addEventListener("change", () => {
            const file = input.files[0]

            if (!file) {
                cleanupObjectUrl(card)
                if (objectEl) {
                    objectEl.removeAttribute("data")
                    objectEl.hidden = true
                }
                if (fallbackMessage) {
                    fallbackMessage.hidden = true
                    fallbackMessage.textContent = fallbackDefaultMessage
                }
                preview.hidden = true
                placeholder.hidden = false
                delete card.dataset.hasPreview
                return
            }

            placeholder.hidden = true
            preview.hidden = false
            card.dataset.hasPreview = "true"

            if (fileNameEl) fileNameEl.textContent = file.name

            cleanupObjectUrl(card)

            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

            if (isPdf) {
                const objectUrl = URL.createObjectURL(file)
                card.__objectUrl = objectUrl
                if (objectEl) {
                    objectEl.data = objectUrl
                    objectEl.hidden = false
                }
                if (fallbackMessage) fallbackMessage.hidden = true
            } else {
                if (objectEl) {
                    objectEl.removeAttribute("data")
                    objectEl.hidden = true
                }
                if (fallbackMessage) {
                    fallbackMessage.hidden = false
                    const previewUnavailableMessage = `Preview unavailable for ${file.name}. Only PDF files can be previewed here.`
                    fallbackMessage.textContent = `${previewUnavailableMessage} Your file will still be uploaded.`
                }
            }
        })
    })

    const form = document.getElementById("module-form")

    form.addEventListener("submit", async (e) => {
        e.preventDefault() // Prevent URL parameters from being added

        const year = document.getElementById("year").value
        const semester = document.getElementById("semester").value
        const moderationNumber = document.getElementById("moderation-number").value
        const name = document.getElementById("module-title").value
        const moduleDeadline = document.getElementById("module-deadline").value
        const moduleDescription = document.getElementById("module-description").value
        const assignmentUpload = document.getElementById("assignment-upload").files[0]
        const rubricUpload = document.getElementById("rubric-upload").files[0]
        
        try {
            const formData = new FormData()
            formData.append("year", year)
            formData.append("semester", semester)
            formData.append("moderation_number", moderationNumber)
            formData.append("name", name)
            formData.append("deadline_date", moduleDeadline)
            formData.append("description", moduleDescription)
            if (assignmentUpload) formData.append("assignment", assignmentUpload)
            if (rubricUpload) formData.append("rubric", rubricUpload)
            // Set upload_date in api

            const res = await fetch("/api/upload_moderation", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token  // keep token for backend auth
                },
                body: formData  // send multipart/form-data
            })
            const data = await res.json()

            if (res.status !== 200 || data.error) {
                console.error("Error publishing module:", data.error)
                alert("Error publishing module. Check console for details.")
                return
            } else {
                console.log("Successfully published module!")
                window.location.href = "moderation-frontpage.html"
            }
        } catch (err) {
            console.error("Network or server error:", err)
        }
    })
})
