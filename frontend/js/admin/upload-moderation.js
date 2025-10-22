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
        
        try {
            const formData = new FormData()
            formData.append("name", name);
            formData.append("year", year);
            formData.append("semester", semester);
            formData.append("assignment_number", assignmentNumber);
            formData.append("moderation_number", moderationNumber);
            formData.append("description", moduleDescription);
            formData.append("due_date", moduleDeadline);
            formData.append("assignment", assignmentUpload);
            // modeSelect is either "automatic" or "manual"
            formData.append("is_rubric_uploaded", modeSelect === "automatic");
            if (modeSelect === "automatic") {
                formData.append("rubric", rubricUpload);
            } else {
                formData.append("rubric_table", JSON.stringify(rubricJSON));
            }
            // Set upload_date in api

            const res = await fetch("/api/upload_module", {
                method: "POST",
                body: formData  // send multipart/form-data
            })
            const data = await res.json()

            if (res.status !== 200 || data.error) {
                alert(`Error Publishing Module: ${data.error}`)
                return
            } else {
                alert("Successfully created module!")
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
        { data: `${gradeMap[0].key}`, title: `${gradeMap[0].name}`, width: 170 },
        { data: `${gradeMap[1].key}`, title: `${gradeMap[0].name}`, width: 170 },
        { data: `${gradeMap[2].key}`, title: `${gradeMap[0].name}`, width: 170 },
        { data: `${gradeMap[3].key}`, title: `${gradeMap[0].name}`, width: 170 },
        { data: `${gradeMap[4].key}`, title: `${gradeMap[0].name}`, width: 170 },
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