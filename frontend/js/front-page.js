

const markingAcc = document.querySelectorAll(".marking-accordion");
const progressAcc = document.querySelectorAll(".progress-accordion");


markingAcc.forEach(a => {
    a.addEventListener("click", function() {
        this.classList.toggle("active");

        const panel = this.nextElementSibling.nextElementSibling;
        if (panel.style.display === "block") {
            panel.style.display = "none";
        } else {
            panel.style.display = "block";
        }
    });
})


progressAcc.forEach(a => {
    a.addEventListener("click", function() {
        this.classList.toggle("active");

        const panel = this.nextElementSibling.nextElementSibling;
        if (panel.style.display === "block") {
            panel.style.display = "none";
        } else {
            panel.style.display = "block";
        }
    });
})



