document.addEventListener("DOMContentLoaded", () => {

    const message = document.querySelector(".successful-message")
    message.style.display = "none"
    const form = document.getElementById("forgot-form")

    const button = document.getElementById("forgot-psw-button")
    const buttonMessage = button.textContent
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      button.disabled = true
      button.textContent = "Sending Email"
      const email = document.getElementById("email").value.trim().toLowerCase();
      try {
          const res = await fetch("/api/forgot_psw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          console.log("res status", res.status)
          console.log("data", data)
          if (!res.ok) {
            alert(data.error)
            return;
          }
          message.style.display = "block"
        } catch (err) {
          console.error("Network or server error:", err);
        } finally {
          button.disabled = false
          button.textContent = buttonMessage
        }
    })
  
  });                                 