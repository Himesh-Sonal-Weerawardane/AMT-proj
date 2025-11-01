


document.addEventListener("DOMContentLoaded", async () => {

    const params = new URLSearchParams(window.location.search);

    const markerID = params.get("id");

    if (!markerID) throw new Error("No user ID");


    try {

        const res = await fetch(`/api/admin/marker/${markerID}/profile`, {
            credentials: "include"
        });

        if (!res.ok) throw new Error("Could not fetch marker");

        const data = await res.json();

        const user = data.marker;

        const moderations = data.moderations || [];

        const initials = `${user.first_name[0] || ""}${user.last_name[0] || ""}`.toUpperCase();

        document.getElementById("profile-circle").textContent = initials;
        document.getElementById("user-name").textContent = `${user.first_name} ${user.last_name}`;
        document.getElementById("user-email").textContent = user.email;
        document.getElementById("user-role").textContent = user.is_admin ? "Admin" : "Marker";

        const moderationContainer = document.querySelector(".moderation-history");
        if (moderations.length === 0) {
            moderationContainer.innerHTML = `<p class="no-history">No moderations found.</p>`;
        } else {

            moderationContainer.insertAdjacentHTML(
                "beforeend",
                `
                <div class="moderation-header">
                    <span class="col-title">Moderation</span>
                    <span class="col-assignment">Assignment</span>
                    <span class="col-semester">Semester</span>
                    <span class="col-date">Submitted At</span>
                    <span class="col-score">Score</span>
                </div>
                
                <div class="divider"></div>
                `
            );


            moderations.forEach(mod => {
                const formattedDate = new Date(mod.submitted_at).toLocaleDateString("en-AU", {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                });

                moderationContainer.insertAdjacentHTML(
                    "beforeend",

                    `
                    <div class="moderation-row">
                        <a href="/marker/moderation-page.html?id=${mod.id}&marker=${user.user_id}" class="moderation-link">${mod.name}</a>
                        <p>${mod.assignment_number}</p>
                        <p>${mod.year} Semester ${mod.semester}</p>
                        <p>${formattedDate}</p>
                        <p>${mod.total_score}</p>
                    
                    </div>
                    
                    <div class="mini-divider"></div>
                    `

                );

            });
        }
    } catch (error) {
        console.error(error);
        document.querySelector(".moderation-history").innerHTML =
            `<p class="no-history">failed to load profile</p>`;
    }

});


