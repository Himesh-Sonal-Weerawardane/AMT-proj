window.addEventListener("DOMContentLoaded", () => {
  initSettingsPofilePrivacy();
});

async function initSettingsPofilePrivacy() {
  try {
    // fetch user data: first_name, last_name, email, role from server
    const res = await fetch("/api/user_info", { method: "POST" });
    const data = await res.json();

    if (res.status !== 200) {
      console.log("Could not fetch user data!");
      return;
    }
    console.log("User data has been fetched");

    // Change profile info to fetched info
    const firstInitial = data.first_name ? data.first_name[0] : "";
    const lastInitial = data.last_name ? data.last_name[0] : "";

    const initialsText = document.getElementById("profile-text-initials");
    if (initialsText) initialsText.textContent = firstInitial + lastInitial;

    const firstNameText = document.getElementById("first-name");
    if (firstNameText) firstNameText.placeholder = data.first_name;

    const lastNameText = document.getElementById("last-name");
    if (lastNameText) lastNameText.placeholder = data.last_name;

    const roleText = document.getElementById("role-text");
    if (roleText) roleText.textContent = data.role;

    const emailText = document.getElementById("current-email-text");
    if (emailText) emailText.textContent = data.email;
  } catch (err) {
    console.log("An error occurred: ", err);
  }
}
