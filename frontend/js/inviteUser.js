const inviteUser = document.getElementById("invite-submit");
inviteUser.addEventListener("click", async (e) => {
  e.preventDefault();

  /*const first_name = document.getElementById("invite-first-name").value.trim();
  const last_name = document.getElementById("invite-last-name").value.trim();*/
  const role = document.getElementById("invite-role").value;
  const email = document
    .getElementById("invite-email")
    .value.trim()
    .toLowerCase();

  try {
    const res = await fetch("/api/invite_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
      //body: JSON.stringify({ first_name, last_name, email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (!data.success) {
      alert("Invite Unsuccessful      " + data.error);
    } else {
      alert("Invite Successful");
    }
  } catch (err) {
    console.error("Network or server error:", err);
  }
});
