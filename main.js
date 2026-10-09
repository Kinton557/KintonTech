document.addEventListener('DOMContentLoaded', () => {
  // Update year
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Highlight Active Link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  // Initialize EmailJS (Public Key implementation)
  if (typeof emailjs !== 'undefined') {
    emailjs.init("YOUR_PUBLIC_KEY"); // Replace with your free EmailJS key
  }

  // Real Email Sender Handler
  const contactForm = document.getElementById('real-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      const btn = contactForm.querySelector('button');

      btn.disabled = true;
      btn.textContent = 'Transmitting Message...';

      // Send actual email via EmailJS API
      emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', contactForm)
        .then(() => {
          status.style.color = '#00d2ff';
          status.textContent = '✔ Inquiry delivered successfully. Our partners will reach out shortly.';
          contactForm.reset();
        }, (error) => {
          status.style.color = '#ff4d4d';
          status.textContent = '❌ Transmission failed. Please try WhatsApp support directly.';
          console.error('Email Error:', error);
        })
        .finally(() => {
          btn.disabled = false;
          btn.textContent = 'Send Formal Inquiry →';
        });
    });
  }
});
