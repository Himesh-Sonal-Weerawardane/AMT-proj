

const params = new URLSearchParams(window.location.search);
const userID = params.get("id");


fetch("./data/staff.json")
    .then(response => response.json())
    .then(data => {
        const user = data.find(u => u.id == userID);

        document.getElementById("user-name").textContent = user.name;
        document.getElementById("user-email").textContent = user.email;
        document.getElementById("user-role").textContent = user.role;
    });