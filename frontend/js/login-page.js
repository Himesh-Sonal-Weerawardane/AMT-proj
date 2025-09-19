// Created by William Alexander Tang Wai on 16/09/2025
// https://www.w3schools.com/howto/howto_js_toggle_password.asp

/**
 * Toggles the visibility of the password input field.
 * Change the input type between 'password' and 'text',
 * and update the eye icon image accordingly.
 */
function togglePassword(psw, eye) {
  const passwordInput = document.getElementById(psw);
  const eyeIcon = document.getElementById(eye);
  
  // absolute paths to eye icons
  const eyeOpen = "/frontend/images/login-page/eye-open.png";
  const eyeClosed = "/frontend/images/login-page/eye-closed.png";

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.src = eyeOpen;   // password visible
  } else {
    passwordInput.type = "password";
    eyeIcon.src = eyeClosed; // password hidden
  }
}

document.getElementById("psw-form").addEventListener("submit", function(event) {
  const psw = document.getElementById("psw").value;
  const confirmPsw = document.getElementById("confirm-psw").value;
  const errorMessage = document.getElementById("psw-error-msg");

  if (psw !== confirmPsw) {
    event.preventDefault(); // stop form from submitting
    errorMessage.style.display = "block"; // show error
  } else {
    errorMessage.style.display = "none"; // hide error if they match
  }
});