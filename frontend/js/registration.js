const registration = document.getElementById("registration-form");
registration.addEventListener("submit", async (e) => {
  e.preventDefault();


  const button = document.getElementById("submit-button")
  const message = button.textContent
  button.disabled=true
  button.textContent = "Registering"

  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get("role");

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
      alert("Registration Unsuccessful      " + data.error);
    } else {
      alert("Registration Successful");
      window.location.href = "../index.html";
    }
  } catch (err) {
    console.error("Network or server error:", err);
  } finally {
    button.disabled = false
    button.textContent = message
  }
});                                 