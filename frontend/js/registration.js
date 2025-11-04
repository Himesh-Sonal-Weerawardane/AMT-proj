const registration = document.getElementById("registration-form");
registration.addEventListener("submit", async (e) => {
  e.preventDefault();

  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get("role") || 1;

  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/register_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password, role }),
    });
    const data = await res.json();
    console.log("res status", res.status)
    console.log("data", data)
    if (!res.ok) {
      alert(data.error);
      return;
    }
    if (!data.success) {
      alert("Invite Unsuccessful      " + data.error);
    } else {
      alert("Invite Successful");
      window.location.href = "../index.html";
    }
  } catch (err) {
    console.error("Network or server error:", err);
  }
});                                 