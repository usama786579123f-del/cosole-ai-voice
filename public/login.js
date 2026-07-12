// js/login.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Session Check: Agar user pehle se login hai, toh direct dashboard par bhej dein
    const existingUser = localStorage.getItem('vas_user');
    if (existingUser) {
        window.location.href = 'console.html';
        return; // Redirect ke baad aage ka code run na ho
    }

    // 2. Form Element ko select karein
    const loginForm = document.getElementById('login-form'); 
    
    // Agar form exist karta hai tabhi event listener lagayein
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Form ko submit hone par page reload hone se rokein

            // Input fields se values nikalein (Ensure karein aapke HTML mein ye IDs hon)
            const emailField = document.getElementById('email');
            const passwordField = document.getElementById('password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            const email = emailField ? emailField.value : 'demo@voiceforge.ai';

            // Button par "Loading" effect lagayein taake real feel aaye
            if (submitBtn) {
                submitBtn.innerHTML = 'Authenticating... <span class="animate-pulse">⏳</span>';
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.7';
            }

            // Ek chota sa delay (800ms) taake backend connection jaisa feel ho
            setTimeout(() => {
                // User ki details ka ek secure local object banayein
                const user = {
                    email: email,
                    role: 'premium_creator',
                    token: 'vas_auth_' + Math.random().toString(36).substr(2, 9),
                    loggedInAt: new Date().toISOString()
                };

                // LocalStorage mein user ka session save karein
                localStorage.setItem('vas_user', JSON.stringify(user));

                // SUCCESS: User ko sidha naye Console (Dashboard) page par bhej dein!
                window.location.href = 'console.html';
                
            }, 800);
        });
    } else {
        console.warn("⚠️ Login form nahi mila! HTML mein <form id='login-form'> zaroor check karein.");
    }
});