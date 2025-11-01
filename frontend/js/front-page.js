

const accordion = document.querySelector('.accordion');


accordion.forEach(item => {
    item.addEventListener('click', function() {
        this.classList.toggle('active');

        const next = this.nextElementSibling;
        if (next.style.display === 'block') {
            next.style.display = 'none';
        } else {
            next.style.display = 'block';
        }
    });
})