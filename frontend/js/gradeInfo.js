

const gradeInfo = {
    // to be parsed...
    HD: {
        name: "High Distinction",
        desc: "Articulates compelling justification for investigating the phenomenon",
        points: "12 - 15 points"
    },

    D: {
        name: "Distinction",
        desc: "Articulates a strong justification for investigating the phenomenon",
        points: "10.5 - 11.5 points"
    },

    C: {
        name: "Credit",
        desc: "Articulates a justification for investigating the phenomenon",
        points: "9 - 10 points"
    },

    P: {
        name: "Pass",
        desc: "Identifies the importance of the phenomenon",
        points: "7.5 - 8.5 points"
    },

    F: {
        name: "Fail",
        desc: "Provides a minimal justification for investigating the phenomenon",
        points: "0 - 7 points"
    }

};



document.addEventListener("DOMContentLoaded", () => {

    const sections = document.querySelectorAll(".scale-section");
    const gradeLabel = document.getElementById("selected-grade");
    const gradeDescription = document.getElementById("grade-description");
    const gradeScore = document.getElementById("grade-score");


    sections.forEach(section => {
        section.addEventListener("click", (e) => {
            sections.forEach(s => s.classList.remove("active"));
            section.classList.add("active");

            const grade = section.dataset.grade;
            const info = gradeInfo[grade];

            gradeLabel.textContent = info.name;
            gradeDescription.textContent = info.desc;
            gradeScore.textContent = info.points;
        });
    });

});


















