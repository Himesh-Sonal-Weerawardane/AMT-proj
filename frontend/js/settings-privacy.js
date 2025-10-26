// Created by William Alexander Tang Wai on 18/09/2025

document
  .getElementById("email-form")
  .addEventListener("submit", function (event) {
    const email = document.getElementById("email").value;
    const confirmEmail = document.getElementById("confirm-email").value;
    const errorMessage = document.getElementById("email-error-msg");

    if (email !== confirmEmail) {
      event.preventDefault(); // stop form from submitting
      errorMessage.style.display = "block"; // show error
    } else {
      errorMessage.style.display = "none"; // hide error if they match
    }
  });

document
  .getElementById("psw-form")
  .addEventListener("submit", function (event) {
    const psw = document.getElementById("password").value;
    const confirmPsw = document.getElementById("confirm-password").value;
    const errorMessage = document.getElementById("psw-error-msg");

    if (psw !== confirmPsw) {
      event.preventDefault(); // stop form from submitting
      errorMessage.style.display = "block"; // show error
    } else {
      errorMessage.style.display = "none"; // hide error if they match
    }
  });
