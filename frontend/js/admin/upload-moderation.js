// Submit publish module form
window.addEventListener("DOMContentLoaded", () => {
    console.log("[PublishModule] Initialising publish module form handlers")
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
            console.log("[PublishModule] File input changed", {
                inputName: input.name,
                fileCount: input.files.length
            })
            const file = input.files[0]

            if (!file) {
                console.log("[PublishModule] No file selected for", input.name)
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
            console.log("[PublishModule] Selected file details", {
                inputName: input.name,
                name: file.name,
                size: file.size,
                type: file.type
            })

            cleanupObjectUrl(card)

            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
            console.log("[PublishModule] File preview check", { inputName: input.name, isPdf })

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
        console.log("[PublishModule] Form submission triggered")

        const year = document.getElementById("year").value
        const semester = document.getElementById("semester").value
        const moderationNumber = document.getElementById("moderation-number").value
        const name = document.getElementById("module-title").value
        const moduleDeadline = document.getElementById("module-deadline").value
        const moduleDescription = document.getElementById("module-description").value
        const assignmentUpload = document.getElementById("assignment-upload").files[0]
        const rubricUpload = document.getElementById("rubric-upload").files[0]

        console.log("[PublishModule] Collected form values", {
            year,
            semester,
            moderationNumber,
            name,
            moduleDeadline,
            hasAssignment: Boolean(assignmentUpload),
            hasRubric: Boolean(rubricUpload)
        })

        try {
            const formData = new FormData()
            formData.append("year", year)
            formData.append("semester", semester)
            formData.append("moderation_number", moderationNumber)
            formData.append("name", name)
            formData.append("due_date", moduleDeadline)
            formData.append("description", moduleDescription)
            if (assignmentUpload) {
                console.log("[PublishModule] Appending assignment file to form data", {
                    name: assignmentUpload.name,
                    size: assignmentUpload.size,
                    type: assignmentUpload.type
                })
                formData.append("assignment", assignmentUpload)
            }
            if (rubricUpload) {
                console.log("[PublishModule] Appending rubric file to form data", {
                    name: rubricUpload.name,
                    size: rubricUpload.size,
                    type: rubricUpload.type
                })
                formData.append("rubric", rubricUpload)
            }
            // Set upload_date in api

            console.log("[PublishModule] Sending fetch request to /api/upload_moderation")
            const options = {
                method: "POST",
                body: formData  // send multipart/form-data
            }

            if (typeof token !== "undefined" && token) {
                options.headers = {
                    Authorization: `Bearer ${token}`  // keep token for backend auth when available
                }
            }

            const res = await fetch("/api/upload_moderation", options)
            console.log("[PublishModule] Received response", {
                status: res.status,
                statusText: res.statusText
            })
            const data = await res.json()
            console.log("[PublishModule] Response JSON payload", data)

            if (res.status !== 200 || data.error) {
                console.error("Error publishing module:", data.error)
                alert("Error publishing module. Check console for details.")
                return
            } else {
                console.log("Successfully published module!")
                const moduleId = data.moduleId
                console.log("[PublishModule] Navigating after successful publish", { moduleId })
                if (moduleId) {
                    window.location.href = `module-detail.html?id=${encodeURIComponent(moduleId)}`
                } else {
                    window.location.href = "moderation-frontpage.html"
                }
            }
        } catch (err) {
            console.error("Network or server error:", err)
            alert("Network or server error occurred while publishing the module. Check console for details.")
        }
    })
})
