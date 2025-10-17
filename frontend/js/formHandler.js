
/* https://www.w3schools.com/howto/howto_js_popup_form.asp */

function openForm() {
    document.getElementById("invite-form").style.display = "block";
    document.querySelector(".container").classList.add("blur");
}

function closeForm() {
    document.getElementById("invite-form").style.display = "none";
    document.querySelector(".container").classList.remove("blur");
}