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
        const assignmentNumber = document.getElementById("assignment-number").value
        const moderationNumber = document.getElementById("moderation-number").value
        const name = document.getElementById("module-title").value
        const moduleDeadline = document.getElementById("module-deadline").value
        const moduleDescription = document.getElementById("module-description").value
        const assignmentUpload = document.getElementById("assignment-upload").files[0]

        const now = new Date();
        const selectedDate = new Date(moduleDeadline);
        if (selectedDate <= now) {
            alert("Deadline must be in the future.");
            return;
        }

        if (!assignmentUpload) return alert("Please select an assignment to upload");

        // Upload rubric, or fill table manually
        const modeSelect = document.getElementById("rubric-mode").value;

        let rubricUpload;
        let rubricTitle;
        let rubricData;
        let rubricJSON;
        if (modeSelect === "automatic") {
            rubricUpload = document.getElementById("rubric-upload").files[0];
            if (!rubricUpload) return alert("Please select a rubric to upload")
            console.log("Automatic Rubric Upload");
        } else {
            // Get rubric table data as array of objects
            rubricTitle = document.getElementById("rubric-title").value;
            rubricData = rubricTable.getSourceData();

            // Columns to check
            const columnsToCheck = [`${criteria}`, ...gradeMap.map(g => g.key), `${criteriaScore}`];

            const hasEmptyCell = rubricData.some(row => {
                const values = Object.values(row);
                // If there are no values at all, the row is empty
                if (values.length === 0) return true;
                
                // Check if a cell is empty
                return columnsToCheck.some(col => {
                    const cell = row[col] == null ? "" : row[col].toString().trim();
                    return cell === "";
                });
            });

            if (hasEmptyCell) {
                alert("Every cell must have some data!");
                return;
            }

            rubricJSON = transformTableToRubric(rubricData, rubricTitle);
            console.log("Manual Rubric Upload");
            // console.log(JSON.stringify(rubricJSON, null, 2));
        }
          
        console.log("[PublishModule] Collected form values", {
            year,
            semester,
            assignmentNumber,
            moderationNumber,
            name,
            moduleDeadline,
            hasAssignmentFile: Boolean(assignmentUpload),
            hasRubricFile: Boolean(rubricUpload),
            hasRubricTable: modeSelect === "automatic"
        });
        
        try {
            const formData = new FormData()
            formData.append("name", name);
            formData.append("year", year);
            formData.append("semester", semester);
            formData.append("assignment_number", assignmentNumber);
            formData.append("moderation_number", moderationNumber);
            formData.append("description", moduleDescription);
            formData.append("due_date", moduleDeadline);
          
             if (assignmentUpload) {
                console.log("[PublishModule] Appending assignment file to form data", {
                    name: assignmentUpload.name,
                    size: assignmentUpload.size,
                    type: assignmentUpload.type
                });
                formData.append("assignment", assignmentUpload);
            }
          
            // modeSelect is either "automatic" or "manual"
            formData.append("is_rubric_uploaded", modeSelect === "automatic");
            if (modeSelect === "automatic") {
                console.log("[PublishModule] Appending rubric file to form data", {
                    name: rubricUpload.name,
                    size: rubricUpload.size,
                    type: rubricUpload.type
                });
                formData.append("rubric", rubricUpload);
            } else {
                console.log("[PublishModule] Appending rubric table to form data");
                formData.append("rubric_table", JSON.stringify(rubricJSON));
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
                alert(`Error Publishing Module: ${data.error}`)
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

const criteria = "criteria";
const gradeMap = [
    { key: "highDistinction", name: "High Distinction" },
    { key: "distinction", name: "Distinction" },
    { key: "credit", name: "Credit" },
    { key: "pass", name: "Pass" },
    { key: "fail", name: "Fail" }
];
const criteriaScore = "criteriaScore";

// https://github.com/handsontable/handsontable
// npm install handsontable
const element = document.getElementById("handsontable-grid");
const rubricTable = new Handsontable(element, {
    // theme name with obligatory ht-theme-* prefix
    themeName: 'ht-theme-main',
    // other options
    columns: [
        { data: `${criteria}`, title: "Criteria", width: 170 },
        ...gradeMap.map(g => ({
            data: g.key,
            title: g.name,
            width: 170
        })),
        { data: `${criteriaScore}`, title: "Criteria Score", width: 100 },
    ],
    data: [
        {}
    ],
    
    height: '100%',
    width: '100%',
    stretchH: 'all',
    rowHeaders: true,
    navigableHeaders: true,
    tabNavigation: true,
    manualColumnResize: true,
    selectionMode: 'range',
    headerClassName: "htLeft",
    licenseKey: "non-commercial-and-evaluation",
    manualRowMove: true,
    contextMenu: true
});


function transformTableToRubric(rubricData, rubricTitle) {
    const rubricJSON = {
        rubric: {
            rubricTitle,
            pdfFile: null
        },
        criteria: []
    };

    // Loop through each row in Handsontable
    rubricData.forEach(row => {
        const criterionText = row.criteria?.trim() || "";
        const maxPointsCell = row.criteriaScore?.trim() || "";

        const criterionObj = {
            criterion: criterionText,
            maxPoints: Number(maxPointsCell.replace(/[^0-9.]/g, "")) || 0,
            grades: []
        };

        // Loop through each grade column
        gradeMap.forEach(({ key, name }) => {
            const cellData = row[key]?.trim() || "";
            const lines = cellData.split("\n").map(l => l.trim()).filter(Boolean);

            if (lines.length === 0) return;

            // Extract points range (e.g. "(12 - 15 points)")
            const lastLine = lines[lines.length - 1];
            const pointsMatch = lastLine.match(/\([^)]*points?\)/i);
            const pointsRange = pointsMatch ? pointsMatch[0] : "";

            // Remove "X points" and "(...) points" lines
            const description = lines.filter(l => !l.match(/points?/i));

            const gradeObj = {
                grade: name,
                pointsRange,
                description
            };

            criterionObj.grades.push(gradeObj);
        });

        rubricJSON.criteria.push(criterionObj);
    });

    return rubricJSON;
}


document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = document.getElementById("rubric-mode");
    const automaticSection = document.getElementById("automatic-rubric");
    const manualSection = document.getElementById("manual-rubric");

    modeSelect.addEventListener("change", (e) => {
        const mode = e.target.value;

        if (mode === "automatic") {
            automaticSection.style.display = "grid";
            manualSection.style.display = "none";
        } else {
            automaticSection.style.display = "none";
            manualSection.style.display = "block";
        }
    });
});
