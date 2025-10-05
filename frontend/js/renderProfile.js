

const params = new URLSearchParams(window.location.search);
const userID = params.get("id");


document.addEventListener("DOMContentLoaded", async () => {
    fetch("./data/staff.json")
        .then(response => response.json())
        .then(data => {
            const user = data.find(u => u.id == userID);

            const initials = user.name.split(" ").map(name => name[0]).join("").toUpperCase();

            document.getElementById("profile-circle").textContent = initials;
            document.getElementById("user-name").textContent = user.name;
            document.getElementById("user-email").textContent = user.email;
            document.getElementById("user-role").textContent = user.role;
        });

});


