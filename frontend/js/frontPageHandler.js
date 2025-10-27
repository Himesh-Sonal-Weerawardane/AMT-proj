

document.addEventListener("DOMContentLoaded", async () => {

    await renderCurrentMarkings();

});


async function renderCurrentMarkings() {
    const container = document.getElementById('current-markings');
    container.innerHTML = '<p>Loading...</p>';

    try {
        const res = await fetch(`/api/moderations/current`);
        if (!res.ok) throw new Error('failed to fetch active moderations');
        const data = await res.json();


        if (!data.assignments?.length) {
            container.innerHTML = "<p>No moderations to complete.</p>";
            return;
        }

        container.innerHTML = `
            <h2>Your Current Markings</h2>
            <h3>${data.year} Semester ${data.semester}</h3>
        `;

        data.assignments.forEach((assignment, i) => {
            const accordion = document.createElement('button');
            accordion.classList.add('marking-accordion');
            accordion.innerHTML =  `<img class="arrow" src="../images/front-page/arrow.png" alt="arrow" />${assignment.name}`;
            container.appendChild(accordion);


            const divider = document.createElement('div');
            divider.classList.add('divider');
            container.appendChild(divider);

            const panel = document.createElement('div');
            divider.classList.add('panel');

            assignment.moderations.forEach(m => {
                const modDiv = document.createElement('div');
                modDiv.classList.add('moderation');

                modDiv.innerHTML = `
                    <a href="moderation-page.html?id=${m.id}" class="moderation-title">${m.name}</a>
                    <div class="moderation-due">${m.due_date || "-"}</div>
                    <div class="moderation-submitted">${m.submitted_at || "-"}</div>
                    <div class="moderation-score">${m.score || "-"}</div>
                `;

                panel.appendChild(modDiv);
                const miniDiv = document.createElement('div');
                miniDiv.classList.add('mini-divider');
                panel.appendChild(miniDiv);
            });

            container.appendChild(panel);

        });
        modAccordions()
    } catch (error) {
        console.log(error);
        container.innerHTML = `<p>Error occurred while fetching moderations.</p>`;
    }
}


function modAccordions() {
    const acc = document.getElementsByClassName("marking-accordion");

    for (let i = 0; i < acc.length; i++) {

        acc[i].addEventListener('click', function () {
            this.classList.toggle('active');
            const panel = this.nextElementSibling.nextElementSibling;

            if (panel.style.display === "block") {
                panel.style.display = "none";
                this.querySelector('.arrow').style.transform = "rotate(0deg)";
            } else {
                panel.style.display = "block";
                this.querySelector('.arrow').style.transform = "rotate(90deg)";
            }

        });
    }

}















