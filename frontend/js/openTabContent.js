
/* Created by Naroline Lim on 17/09/25 */
/* JS tabs tutorial https://www.w3schools.com/howto/howto_js_tabs.asp */


function openTabContent(evt, tabName) {
    var i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }


    document.getElementById(tabName).style.display = 'block';
    evt.currentTarget.className += " active";

}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("defaultOpen").click();
});