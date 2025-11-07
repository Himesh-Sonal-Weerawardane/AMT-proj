const inviteUser = document.getElementById("invite-submit");
inviteUser.addEventListener("click", async (e) => {
  e.preventDefault();

  const message = inviteUser.textContent
  inviteUser.disabled=true
  inviteUser.textContent = "Sending invite"
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
    });
    const data = await res.json();
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (!data.success) {
      alert("Invite Unsuccessful      " + data.error)
    } else {
      alert("Invite Successful, Please check your email for registration")
    }
  } catch (err) {
    console.error("Network or server error:", err);
  } finally {
    inviteUser.disabled = false
    inviteUser.textContent = message
  }
});