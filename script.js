// Global variables no longer needed for pie tracking
// Pie counts will be retrieved from Google Sheets in real-time

// Password validation
document.getElementById('submitPassword').addEventListener('click', function() {
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (password === 'ilovepie') {
        // Clear any previous error
        errorDiv.textContent = '';
        
        // Start the animation sequence
        animatePasswordSuccess();
    } else {
        // Show error message
        errorDiv.textContent = 'Incorrect password. Please try again.';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
});

// Handle Enter key in password input
document.getElementById('passwordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('submitPassword').click();
    }
});

function animatePasswordSuccess() {
    const passwordScreen = document.getElementById('passwordScreen');
    const mainContent = document.getElementById('mainContent');
    const contentBox = document.getElementById('contentBox');
    
    // Fade out password screen
    passwordScreen.style.opacity = '0';
    
    setTimeout(() => {
        passwordScreen.style.display = 'none';
        mainContent.classList.remove('hidden');
        
        // Fade in the main content
        setTimeout(() => {
            contentBox.classList.add('visible');
        }, 100);
    }, 500);
}

// Form submission handling
document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Immediately disable the submit button to prevent double-clicking
    const submitButton = document.getElementById('submitForm');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    submitButton.style.opacity = '0.6';
    submitButton.style.cursor = 'not-allowed';
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    
    console.log('Form submitted with:', { firstName, lastName, email });
    
    try {
        // Check if email already exists in Google Sheets
        const emailExists = await checkEmailExists(email);
        
        if (emailExists.exists) {
            // Email already exists, show existing pie assignment
            console.log('Email already exists with pie type:', emailExists.pieType);
            
            const resultDiv = document.getElementById('assignmentResult');
            resultDiv.textContent = `Already Submitted. Your Pie is ${emailExists.pieType}.`;
            resultDiv.classList.add('show');
            
            // Hide the submit button and form inputs
            hideFormElements();
            
            return; // Stop here, don't process as new registration
        }
        
        // Email doesn't exist, proceed with normal registration
        console.log('Email not found, proceeding with new registration');
        
        // Get current pie counts from Google Sheets and assign pie type
        const pieType = await assignPieTypeFromSheet();
        const isWildCard = pieType === 'Wild Card';
        
        console.log('Pie assigned:', pieType);
        
        // Display result
        const resultDiv = document.getElementById('assignmentResult');
        resultDiv.textContent = isWildCard
            ? `🎉 Wild Card! You get to choose which pie to bring \u2014 sweet or savoury.`
            : `You are bringing a ${pieType} pie`;
        resultDiv.classList.add('show');
        
        // Hide the submit button and form inputs
        hideFormElements();
        
        // Send email
        sendEmail(email, firstName, lastName, pieType);
        
        // Save to Google Sheets
        saveToGoogleSheets(firstName, lastName, email, pieType);
        
        // Reset form
        document.getElementById('registrationForm').reset();
        
    } catch (error) {
        console.log('❌ Error during form submission:', error);
        
        // Re-enable the button if there was an error
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
        
        alert('Something went wrong. Please try again.');
    }
});

async function checkEmailExists(email) {
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbzriY4eX1uR93CuzraxvUW9qH__M9IU_rL5cYD9O7lVmQyLvivZbdyLOdlxNFVVuDPl/exec';
    
    console.log('Checking if email exists:', email);
    
    try {
        const checkUrl = `${scriptUrl}?action=checkEmail&email=${encodeURIComponent(email)}`;
        console.log('Check URL:', checkUrl);
        
        const response = await fetch(checkUrl, {
            method: 'GET'
        });
        
        console.log('Response status:', response.status);
        console.log('Response URL:', response.url);
        
        const responseText = await response.text();
        console.log('Raw response length:', responseText.length);
        console.log('Raw response first 100 chars:', responseText.substring(0, 100));
        
        // Check if response looks like HTML (redirect page)
        if (responseText.trim().startsWith('<')) {
            console.log('❌ Got HTML instead of JSON - possible redirect or permission issue');
            return { exists: false, message: 'Got HTML response instead of JSON' };
        }
        
        // Try to parse as JSON
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('✅ Parsed JSON result:', result);
        } catch (parseError) {
            console.log('❌ JSON parse error:', parseError);
            console.log('Response was not JSON, treating as email not found');
            console.log('Full response text:', responseText);
            return { exists: false, message: 'Invalid response format' };
        }
        
        return result;
        
    } catch (error) {
        console.log('❌ Failed to check email:', error);
        console.log('Proceeding with registration due to check failure');
        
        // If check fails, assume email doesn't exist to allow registration
        return { exists: false, message: 'Check failed, proceeding with registration' };
    }
}

function hideFormElements() {
    // Hide the submit button to prevent resubmission
    const submitButton = document.getElementById('submitForm');
    submitButton.style.display = 'none';
    
    // Hide all form input boxes to prevent modification
    const formInputs = document.querySelectorAll('#registrationForm input[type="text"], #registrationForm input[type="email"]');
    formInputs.forEach(input => {
        input.style.display = 'none';
    });
    
    // Hide the form labels as well
    const formLabels = document.querySelectorAll('#registrationForm label');
    formLabels.forEach(label => {
        label.style.display = 'none';
    });
}

// Registrant numbers (1-indexed, counting this new signup) that get to
// choose their own pie type instead of being auto-assigned.
const WILD_CARD_SLOTS = [5, 7];

async function assignPieTypeFromSheet() {
    console.log('Getting pie counts from Google Sheets...');
    
    try {
        const counts = await getPieCountsFromSheet();
        console.log('Current pie counts from sheet:', counts);
        
        const registrantNumber = (counts.total || 0) + 1;
        console.log('This registrant would be number:', registrantNumber);
        
        if (WILD_CARD_SLOTS.includes(registrantNumber)) {
            console.log('This registrant lands on a wild card slot!');
            return 'Wild Card';
        }
        
        // Ensure 50/50 split based on actual sheet data
        if (counts.sweetCount <= counts.savoryCount) {
            console.log('Assigning sweet pie (sweet count <= savory count)');
            return 'sweet';
        } else {
            console.log('Assigning savory pie (sweet count > savory count)');
            return 'savoury';
        }
        
    } catch (error) {
        console.log('❌ Failed to get pie counts, defaulting to sweet:', error);
        // If we can't get counts, default to sweet
        return 'sweet';
    }
}

async function getPieCountsFromSheet() {
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbzriY4eX1uR93CuzraxvUW9qH__M9IU_rL5cYD9O7lVmQyLvivZbdyLOdlxNFVVuDPl/exec';
    
    try {
        const countsUrl = `${scriptUrl}?action=getPieCounts`;
        console.log('Pie counts URL:', countsUrl);
        
        const response = await fetch(countsUrl, {
            method: 'GET'
        });
        
        const responseText = await response.text();
        console.log('Pie counts raw response:', responseText);
        
        const result = JSON.parse(responseText);
        console.log('Pie counts parsed result:', result);
        
        return result;
        
    } catch (error) {
        console.log('❌ Failed to get pie counts:', error);
        throw error;
    }
}

function sendEmail(email, firstName, lastName, pieType) {
    console.log('Attempting to send email to:', email);
    console.log('EmailJS available:', typeof emailjs !== 'undefined');
    
    // Send email via EmailJS
    if (typeof emailjs !== 'undefined') {
        console.log('EmailJS is loaded, attempting to send email...');
        
        const templateParams = {
            to_email: email,
            to_name: `${firstName} ${lastName}`,
            pie_type: pieType,
            event_date: 'Sunday October 4th at 2pm 2026'
        };
        
        console.log('Template params:', templateParams);
        console.log('Service ID: service_rhkhjdl');
        console.log('Template ID: template_njpknfc');
        
        // Check if EmailJS is initialized
        if (typeof emailjs.send === 'function') {
            emailjs.send('service_rhkhjdl', 'template_njpknfc', templateParams)
                .then(function(response) {
                    console.log('✅ Email sent successfully:', response);
                    alert('Registration complete! Check your email for confirmation.');
                }, function(error) {
                    console.log('❌ Email failed to send:', error);
                    console.log('Error details:', {
                        status: error.status,
                        text: error.text,
                        response: error.response
                    });
                    
                    // More specific error messages
                    if (error.status === 422) {
                        alert('Registration saved! Email template error (422). Check your EmailJS template variables.');
                    } else if (error.status === 400) {
                        alert('Registration saved! Bad request (400). Check your service/template IDs.');
                    } else if (error.status === 401) {
                        alert('Registration saved! Unauthorized (401). Check your EmailJS public key.');
                    } else {
                        alert(`Registration saved! Email failed to send. Error: ${error.status}`);
                    }
                });
        } else {
            console.log('❌ EmailJS.send function not available');
            alert('Registration saved! Email service unavailable.');
        }
    } else {
        console.log('❌ EmailJS not loaded');
        alert('Registration saved! Email service unavailable.');
    }
}

function saveToGoogleSheets(firstName, lastName, email, pieType) {
    // Replace this URL with your Google Apps Script web app URL
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbzriY4eX1uR93CuzraxvUW9qH__M9IU_rL5cYD9O7lVmQyLvivZbdyLOdlxNFVVuDPl/exec';
    
    console.log('Saving to Google Sheets:', { firstName, lastName, email, pieType });
    
    const data = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        pieType: pieType,
        eventDate: 'Sunday October 4th at 2pm 2026'
    };
    
    console.log('Data being sent to Google Sheets:', data);
    
    fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log('✅ Data sent to Google Sheets');
        console.log('Response type:', response.type);
        
        if (response.type === 'opaque') {
            console.log('✅ Google Sheets submission appears successful');
        }
    })
    .catch(error => {
        console.log('❌ Failed to save to Google Sheets:', error);
        console.log('Error details:', error);
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing...');
    
    // Focus on password input when page loads
    document.getElementById('passwordInput').focus();
    
    // Handle Enter key in form inputs
    const formInputs = document.querySelectorAll('#registrationForm input');
    formInputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('submitForm').click();
            }
        });
    });
    
    console.log('Initialization complete');
});

// Add EmailJS script for email functionality
console.log('Loading EmailJS script...');
const emailjsScript = document.createElement('script');
emailjsScript.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
emailjsScript.onload = function() {
    console.log('✅ EmailJS script loaded successfully');
    // Initialize EmailJS with your public key
    emailjs.init('ZQkBKBsfcuuh5GyGk');
    console.log('EmailJS initialized with public key');
};
emailjsScript.onerror = function() {
    console.log('❌ Failed to load EmailJS script');
};
document.head.appendChild(emailjsScript);