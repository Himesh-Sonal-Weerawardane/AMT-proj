

/* Fetching and rendering the rubric */


let rubricData;

document.addEventListener('DOMContentLoaded', () => {

    fetch("./data/rubric.json")
        .then(response => response.json())
        .then(data => {
            rubricData = data;

            document.getElementById("moderation-doc").src = rubricData.rubric.pdfFile;
            document.getElementById("moderation-title").textContent = rubricData.rubric.rubricTitle;

            moderationHandler(rubricData);

            alertSubmission()

        });

});

function moderationHandler(data) {

    const criteria = document.getElementById("criteria");
    criteria.innerHTML = "";

    data.criteria.forEach((element, index) => {

        const row = document.createElement("tr");

        /* Criterion Title */
        const criterionTitle = document.createElement("td");
        criterionTitle.textContent = element.criterion;
        row.appendChild(criterionTitle);


        /* Criterion Description and Point Range for each grade group */
        element.grades.forEach(grade => {

            const gradeGroup = document.createElement("td");

            const gradeDescription = document.createElement("ul");
            grade.description.forEach(d => {
                const li = document.createElement("li");
                li.textContent = d;
                gradeDescription.appendChild(li);
            });
            gradeGroup.appendChild(gradeDescription);


            const range = document.createElement("p");
            range.textContent = grade.pointsRange;
            gradeGroup.appendChild(range);

            row.appendChild(gradeGroup);
        });

        /* Criterion Input Score */
        const criterionScore = document.createElement("td");
        const criterionInput = document.createElement("input");

        criterionInput.id = `score-${index}`;
        criterionInput.type = "number";
        criterionInput.min = 0;
        criterionInput.max = element.maxPoints;
        criterionInput.style.width = "50px";
        criterionInput.classList.add("score-input");

        const maxPointsLabel = document.createElement("span");
        maxPointsLabel.textContent = ` / ${element.maxPoints}`;
        maxPointsLabel.style.marginLeft = "4px";

        criterionScore.appendChild(criterionInput);
        criterionScore.appendChild(maxPointsLabel);
        row.appendChild(criterionScore);


        /* User Comments */
        const criterionComment = document.createElement("td");
        criterionComment.contentEditable = "true";
        criterionComment.setAttribute("data-placeholder", "Enter comment...");
        criterionComment.classList.add("comment-cell");
        row.appendChild(criterionComment);


        criteria.appendChild(row);

    });

}


function alertSubmission() {
    const submitButton = document.getElementById("moderation-submit");

    submitButton.addEventListener("click", () => {
        const scoreInput = document.querySelectorAll(".score-input");

        const allScoresFilled = Array.from(scoreInput).every(inp => inp.value.trim() !== "");

        if (allScoresFilled) {
            alert("Moderation submitted successfully!");
        } else {
            alert("Please fill in all scores before submission!");
        }
    });

}





















