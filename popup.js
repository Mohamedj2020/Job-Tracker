// Resume data - these would normally be loaded from files
const RESUMES = {
  'pm': {
    name: 'Product Manager',
    keywords: 'product strategy,roadmapping,user research,data analysis,a/b testing,agile,scrum,stakeholder management,market analysis,user experience,feature prioritization,cross-functional leadership,product metrics,customer development,competitive analysis,product launch,user stories,sprint planning,backlog management,user interviews,analytics tools,product vision,go-to-market strategy'
  },
  'swe': {
    name: 'Software Engineer',
    keywords: 'javascript,python,react,node.js,aws,restful apis,microservices,database design,git,docker,kubernetes,agile,scrum,code review,system architecture,performance optimization,testing,ci/cd,devops,cloud computing,api design,data structures,algorithms,object-oriented programming,functional programming,web development,mobile development,machine learning,data analysis,debugging,problem solving,technical leadership,mentoring'
  },
  'cyber': {
    name: 'Cybersecurity',
    keywords: 'penetration testing,siem,incident response,vulnerability assessment,risk analysis,security controls,compliance,soc 2,iso 27001,network security,threat intelligence,security policies,security awareness,malware analysis,digital forensics,security tools,firewall configuration,intrusion detection,security auditing,threat hunting,security architecture,cryptography,access control,identity management,security monitoring,incident management,security frameworks,risk management,security assessment,compliance frameworks,security training'
  },
  'consulting': {
    name: 'Consulting',
    keywords: 'strategic planning,market analysis,business strategy,financial analysis,stakeholder management,client relations,project management,competitive intelligence,operational excellence,change management,business case development,data analysis,presentation skills,workshop facilitation,process improvement,risk assessment,performance metrics,business development,proposal writing,industry research,benchmarking,cost-benefit analysis,organizational design,leadership development,performance management,strategic communications,problem solving,critical thinking,team leadership,executive presentations'
  }
};

// Airtable configuration - Load from Chrome storage
let AIRTABLE_CONFIG = {
  apiKey: '',
  baseId: 'appJczg3KLNlLOiSk', // Your Airtable base ID
  tableId: 'tblVLjTgwr6DP7P6e' // Your table ID
};
// Load Airtable API key from Chrome storage
chrome.storage.local.get(['airtableApiKey'], (result) => {
  if (result.airtableApiKey) {
    AIRTABLE_CONFIG.apiKey = result.airtableApiKey;
    updateApiKeyStatus(true);
  } else {
    updateApiKeyStatus(false);
  }
  
  // Update database status to show it's configured
  const databaseStatusElement = document.getElementById('databaseStatus');
  if (databaseStatusElement) {
    databaseStatusElement.innerHTML = '✅ Base and Table configured';
    databaseStatusElement.style.color = '#28a745';
  }
});

// Update API key status display
function updateApiKeyStatus(configured) {
  const statusElement = document.getElementById('tokenStatus');
  const buttonElement = document.getElementById('configureToken');
  const clearButton = document.getElementById('clearToken');
  
  if (configured) {
    statusElement.innerHTML = '✅ Airtable API Key configured';
    statusElement.style.color = '#28a745';
    buttonElement.textContent = 'Change API Key';
    clearButton.style.display = 'block';
  } else {
    statusElement.innerHTML = '❌ Airtable API Key not configured';
    statusElement.style.color = '#dc3545';
    buttonElement.textContent = 'Configure API Key';
    clearButton.style.display = 'none';
  }
}

// Scoring function
function calculateScore(jobText, resumeKeywords) {
  try {
    const jobWords = jobText.toLowerCase().split(/\s+/);
    const resumeWords = resumeKeywords.toLowerCase().split(',');
    
    let matches = 0;
    let totalKeywords = resumeWords.length;
    
    for (let keyword of resumeWords) {
      keyword = keyword.trim();
      if (jobWords.some(word => word.includes(keyword) || keyword.includes(word))) {
        matches++;
      }
    }
    
    const percentage = Math.round((matches / totalKeywords) * 100);
    
    // Convert to letter grade
    let grade;
    if (percentage >= 80) grade = 'A';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 40) grade = 'C';
    else if (percentage >= 20) grade = 'D';
    else grade = 'E';
    
    return { percentage, grade, matches, totalKeywords };
  } catch (error) {
    console.error('Error calculating score:', error);
    return { percentage: 0, grade: 'E', matches: 0, totalKeywords: 0 };
  }
}

// Get missing keywords
function getMissingKeywords(jobText, resumeKeywords) {
  const jobWords = jobText.toLowerCase().split(/\s+/);
  const resumeWords = resumeKeywords.toLowerCase().split(',');
  
  const missing = [];
  for (let keyword of resumeWords) {
    keyword = keyword.trim();
    if (!jobWords.some(word => word.includes(keyword) || keyword.includes(word))) {
      missing.push(keyword);
    }
  }
  
  return missing.slice(0, 5); // Return top 5 missing keywords
}

// Scrape job information from the page
async function scrapeJobInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Enhanced selectors for job sites
        const selectors = {
          title: [
            'h1[class*="title"]',
            'h1[class*="job"]',
            '.job-title',
            '.position-title',
            '[data-testid="job-title"]',
            '[data-automation="job-title"]',
            'h1',
            '.title',
            '[class*="job-title"]',
            '[class*="position-title"]'
          ],
          company: [
            '[class*="company"]',
            '[class*="employer"]',
            '.company-name',
            '[data-testid="company"]',
            '[data-automation="company"]',
            '.employer',
            '[class*="employer-name"]',
            '[class*="company-name"]'
          ],
          location: [
            '[class*="location"]',
            '.job-location',
            '[data-testid="location"]',
            '[data-automation="location"]',
            '.location',
            '[class*="job-location"]',
            '[class*="position-location"]'
          ],
          description: [
            '[class*="description"]',
            '.job-description',
            '[data-testid="description"]',
            '[data-automation="description"]',
            '.description',
            '.job-details',
            '.job-summary',
            '[class*="job-description"]',
            '[class*="position-description"]',
            '.content',
            '.details'
          ]
        };
        
        function findText(selectors) {
          for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
              const text = element.textContent.trim();
              if (text && text.length > 3) {
                return text;
              }
            }
          }
          return '';
        }
        
        // Try to find job information
        let title = findText(selectors.title);
        let company = findText(selectors.company);
        let location = findText(selectors.location);
        let description = findText(selectors.description);
        
        // Fallback: try to get any text content
        const allText = document.body.textContent || '';
        
        // If we still don't have a title, try to extract from page title
        if (!title || title === 'Job Title Not Found') {
          const pageTitle = document.title;
          if (pageTitle && !pageTitle.includes('404') && !pageTitle.includes('Error')) {
            title = pageTitle.replace(/[-|]/, '').trim();
          }
        }
        
        // If we don't have company, try to extract from URL or page
        if (!company || company === 'Company Not Found') {
          const hostname = window.location.hostname;
          const url = window.location.href;
          
          // Try to extract company from various sources
          if (hostname.includes('linkedin.com')) {
            company = 'LinkedIn';
          } else if (hostname.includes('indeed.com')) {
            company = 'Indeed';
          } else if (hostname.includes('workday.com')) {
            company = 'Workday';
          } else if (hostname.includes('greenhouse.io')) {
            company = 'Greenhouse';
          } else if (hostname.includes('lever.co')) {
            company = 'Lever';
          } else if (hostname.includes('rtx.com') || url.includes('rtx.com')) {
            company = 'RTX';
          } else if (hostname.includes('careers.rtx.com')) {
            company = 'RTX';
          } else {
            // Try to extract from page content
            const companyElements = document.querySelectorAll('[class*="company"], [class*="employer"], [class*="organization"]');
            for (let element of companyElements) {
              const text = element.textContent.trim();
              if (text && text.length > 2 && text.length < 50) {
                company = text;
                break;
              }
            }
          }
        }
        
        // If we don't have location, try to extract from page
        if (!location || location === 'Location Not Found' || location === 'Locations') {
          const locationElements = document.querySelectorAll('[class*="location"], [class*="place"], [class*="city"]');
          for (let element of locationElements) {
            const text = element.textContent.trim();
            if (text && text.length > 3 && text.length < 100 && 
                (text.includes(',') || text.includes('United States') || text.includes('Remote'))) {
              location = text;
              break;
            }
          }
        }
        
        return {
          title: title || 'Job Title Not Found',
          company: company || 'Company Not Found',
          location: location || 'Location Not Found',
          description: description || allText.substring(0, 2000),
          url: window.location.href
        };
      }
    });
    
    const jobInfo = results[0].result;
    
    // Validate that we got some useful information
    if (jobInfo.title === 'Job Title Not Found' && jobInfo.company === 'Company Not Found') {
      throw new Error('Could not extract job information from this page');
    }
    
    return jobInfo;
  } catch (error) {
    console.error('Error scraping job info:', error);
    throw error;
  }
}

// Test Airtable connection
async function testAirtableConnection() {
  if (!AIRTABLE_CONFIG.apiKey) {
    alert('Please configure your Airtable API key first!');
    return;
  }

  console.log('Testing Airtable connection...');
  
  try {
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${AIRTABLE_CONFIG.tableId}?maxRecords=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Airtable connection successful:', data);
      alert('✅ Airtable connection successful!\n\nYour API key has access to the Job Tracker base.');
    } else if (response.status === 401) {
      alert('❌ Invalid API key.\n\nPlease check:\n• Your API key is correct\n• Key hasn\'t expired\n• You copied the full key');
    } else if (response.status === 403) {
      alert('❌ Access denied.\n\nPlease check your API key permissions for this base.');
    } else if (response.status === 404) {
      alert('❌ Base or table not found.\n\nPlease check your base ID and table ID.');
    } else {
      const errorData = await response.json();
      console.error('Airtable API error:', errorData);
      alert(`❌ Error ${response.status}: ${errorData.error?.message || 'Unknown error'}\n\nPlease check your API key settings.`);
    }
  } catch (error) {
    console.error('Connection error:', error);
    alert(`❌ Connection failed: ${error.message}\n\nPlease check your internet connection and try again.`);
  }
}

// Save to Airtable
async function saveToAirtable(jobInfo, bestResume) {
  if (!AIRTABLE_CONFIG.apiKey) {
    alert('Please configure your Airtable API key first! Click "Configure API Key" to set it up.');
    return;
  }
  
  console.log('Saving to Airtable base:', AIRTABLE_CONFIG.baseId);
  
  try {
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${AIRTABLE_CONFIG.tableId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              'Name': jobInfo.title || 'Unknown Job Title',
              'Notes': `Company: ${jobInfo.company || 'Unknown'}\nLocation: ${jobInfo.location || 'Unknown'}\nLink: ${jobInfo.url || ''}\nResume Used: ${bestResume.name}\nMatch Score: ${bestResume.score.percentage}%\nDescription: ${jobInfo.description ? jobInfo.description.substring(0, 1000) + '...' : 'No description available'}`,
              'Status': 'Todo'
            }
          }
        ]
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Successfully saved to Airtable:', result);
      alert('✅ Job saved to Airtable successfully!\n\nCheck your Job Tracker base for the new entry.');
    } else {
      const errorData = await response.json();
      console.error('Airtable API error:', errorData);
      
      let errorMessage = `Failed to save to Airtable: ${response.status} ${response.statusText}`;
      
      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your Airtable API key.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please check your API key permissions.';
      } else if (response.status === 404) {
        errorMessage = 'Base or table not found. Please check your base ID and table ID.';
      }
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error saving to Airtable:', error);
    alert(`Error saving to Airtable: ${error.message}\n\nPlease check your API key and permissions.`);
  }
}

// Auto-fill application forms
async function autofillApplicationForm(jobInfo, bestResume) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (jobInfo, bestResume) => {
        // Common form field selectors
        const selectors = {
          firstName: ['input[name*="first"], input[name*="firstName"], input[id*="first"], input[placeholder*="First"]'],
          lastName: ['input[name*="last"], input[name*="lastName"], input[id*="last"], input[placeholder*="Last"]'],
          email: ['input[type="email"], input[name*="email"], input[id*="email"]'],
          phone: ['input[type="tel"], input[name*="phone"], input[id*="phone"], input[name*="mobile"]'],
          address: ['input[name*="address"], textarea[name*="address"]'],
          city: ['input[name*="city"], input[id*="city"]'],
          state: ['input[name*="state"], input[id*="state"], select[name*="state"]'],
          zip: ['input[name*="zip"], input[name*="postal"], input[id*="zip"]'],
          linkedin: ['input[name*="linkedin"], input[id*="linkedin"], input[placeholder*="LinkedIn"]'],
          portfolio: ['input[name*="portfolio"], input[name*="website"], input[id*="portfolio"]'],
          coverLetter: ['textarea[name*="cover"], textarea[name*="letter"], textarea[id*="cover"]']
        };

        // Your personal information - Update these with your actual details
        const personalInfo = {
          firstName: 'Mohamed',
          lastName: 'Jirac',
          email: 'jirac.1@osu.edu', // Update this
          phone: '66146803440', // Update this
          address: 'Your Address', // Update this
          city: 'Your City', // Update this
          state: 'Your State', // Update this
          zip: 'Your ZIP', // Update this
          linkedin: 'https://linkedin.com/in/yourprofile', // Update this
          portfolio: 'https://yourportfolio.com' // Update this
        };

        function fillField(selectors, value) {
          for (let selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
              if (element.type !== 'hidden' && !element.disabled) {
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
          }
          return false;
        }

        // Fill personal information
        fillField(selectors.firstName, personalInfo.firstName);
        fillField(selectors.lastName, personalInfo.lastName);
        fillField(selectors.email, personalInfo.email);
        fillField(selectors.phone, personalInfo.phone);
        fillField(selectors.address, personalInfo.address);
        fillField(selectors.city, personalInfo.city);
        fillField(selectors.state, personalInfo.state);
        fillField(selectors.zip, personalInfo.zip);
        fillField(selectors.linkedin, personalInfo.linkedin);
        fillField(selectors.portfolio, personalInfo.portfolio);

        // Generate and fill cover letter based on job and resume match
        const coverLetter = generateCoverLetter(jobInfo, bestResume);
        fillField(selectors.coverLetter, coverLetter);

        // Show success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #28a745;
          color: white;
          padding: 15px;
          border-radius: 8px;
          z-index: 10000;
          font-family: Arial, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        successDiv.innerHTML = `
          <strong>✅ Auto-fill Complete!</strong><br>
          Form filled with ${bestResume.name} resume<br>
          Match Score: ${bestResume.score.percentage}%
        `;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
          successDiv.remove();
        }, 5000);

      },
      args: [jobInfo, bestResume]
    });
    
    alert('Application form auto-filled successfully!');
  } catch (error) {
    console.error('Error auto-filling form:', error);
    alert('Error auto-filling form. Please check the page and try again.');
  }
}

// Generate cover letter based on job and resume match
function generateCoverLetter(jobInfo, bestResume) {
  const templates = {
    'Product Manager': `Dear Hiring Manager,

I am excited to apply for the ${jobInfo.title} position at ${jobInfo.company}. With my experience in product strategy, user research, and cross-functional leadership, I am confident I can contribute significantly to your team.

My background includes leading product roadmaps, conducting user research, and driving data-driven product decisions that have increased user engagement by 40%. I have successfully managed cross-functional teams and implemented agile methodologies to deliver products that meet user needs and business objectives.

I am particularly drawn to this opportunity because of ${jobInfo.company}'s innovative approach to product development and commitment to user-centered design. I believe my skills in stakeholder management, market analysis, and go-to-market strategy align perfectly with your requirements.

Thank you for considering my application. I look forward to discussing how I can contribute to ${jobInfo.company}'s continued success.

Best regards,
Mohamed Jira`,

    'Software Engineer': `Dear Hiring Manager,

I am writing to express my interest in the ${jobInfo.title} position at ${jobInfo.company}. With my strong background in full-stack development, system architecture, and modern technologies, I am excited about the opportunity to contribute to your engineering team.

My experience includes developing scalable web applications using React, Node.js, and Python, as well as implementing microservices architectures that have improved system performance by 60%. I have led technical architecture decisions, mentored junior developers, and maintained high code quality standards through comprehensive testing and CI/CD practices.

I am particularly interested in this role because of ${jobInfo.company}'s commitment to innovation and the opportunity to work with cutting-edge technologies. My skills in cloud computing, API design, and performance optimization align well with your technical requirements.

Thank you for considering my application. I look forward to discussing how my technical expertise can contribute to ${jobInfo.company}'s engineering excellence.

Best regards,
Mohamed Jira`,

    'Cybersecurity': `Dear Hiring Manager,

I am excited to apply for the ${jobInfo.title} position at ${jobInfo.company}. With my extensive experience in cybersecurity analysis, incident response, and security controls implementation, I am confident I can strengthen your organization's security posture.

My background includes conducting security assessments, managing SIEM systems, and responding to security incidents in real-time. I have successfully implemented compliance frameworks such as SOC 2 and ISO 27001, and have led security awareness training programs that have improved organizational security culture.

I am particularly drawn to this opportunity because of ${jobInfo.company}'s commitment to maintaining robust security standards and protecting sensitive information. My expertise in threat intelligence, vulnerability assessment, and security architecture aligns perfectly with your security requirements.

Thank you for considering my application. I look forward to discussing how I can contribute to ${jobInfo.company}'s security initiatives.

Best regards,
Mohamed Jira`,

    'Consulting': `Dear Hiring Manager,

I am writing to express my interest in the ${jobInfo.title} position at ${jobInfo.company}. With my experience in strategic consulting, business analysis, and stakeholder management, I am excited about the opportunity to contribute to your consulting practice.

My background includes leading strategic engagements for Fortune 500 clients, conducting market analysis, and developing business strategies that drive operational excellence. I have successfully managed client relationships, delivered presentations to C-suite executives, and led cross-functional teams on complex projects.

I am particularly interested in this role because of ${jobInfo.company}'s reputation for delivering high-impact solutions and the opportunity to work with diverse clients across industries. My skills in strategic planning, financial analysis, and change management align well with your consulting requirements.

Thank you for considering my application. I look forward to discussing how I can contribute to ${jobInfo.company}'s continued success in delivering value to clients.

Best regards,
Mohamed Jira`
  };

  return templates[bestResume.name] || templates['Software Engineer'];
}

// Display results
function displayResults(jobInfo, scores) {
  try {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    
    // Update job info
    const jobTitleElement = document.getElementById('jobTitle');
    const companyElement = document.getElementById('company');
    const locationElement = document.getElementById('location');
    
    if (jobTitleElement) jobTitleElement.textContent = jobInfo.title || 'Job Title Not Found';
    if (companyElement) companyElement.textContent = jobInfo.company || 'Company Not Found';
    if (locationElement) locationElement.textContent = jobInfo.location || 'Location Not Found';
    
    // Display resume scores
    const scoresContainer = document.getElementById('resumeScores');
    if (!scoresContainer) {
      console.error('resumeScores element not found');
      return;
    }
    
    scoresContainer.innerHTML = '';
    
    if (scores && scores.length > 0) {
      scores.forEach(score => {
        try {
          const scoreElement = document.createElement('div');
          const grade = score.grade || 'e'; // Default to 'e' if grade is undefined
          scoreElement.className = `resume-score score-${grade.toLowerCase()}`;
          
          const missingKeywords = getMissingKeywords(jobInfo.description || '', RESUMES[score.id].keywords);
          
          scoreElement.innerHTML = `
            <div>
              <div class="resume-name">${score.name}</div>
              <div class="missing-keywords">
                Missing: ${missingKeywords.join(', ')}
              </div>
            </div>
            <div class="score-details">
              <div class="score-percent">${score.score.percentage}%</div>
              <div class="score-grade">${score.score.grade}</div>
            </div>
          `;
          
          scoresContainer.appendChild(scoreElement);
        } catch (scoreError) {
          console.error('Error creating score element:', scoreError);
        }
      });
    } else {
      // Show default message if no scores
      scoresContainer.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No resume matches available</div>';
    }
  } catch (error) {
    console.error('Error in displayResults:', error);
    // Fallback: show basic content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }
}

// Main function
async function analyzeJob() {
  try {
    const jobInfo = await scrapeJobInfo();
    
    // Calculate scores for all resumes
    const scores = Object.entries(RESUMES).map(([id, resume]) => {
      const score = calculateScore(jobInfo.description, resume.keywords);
      return {
        id,
        name: resume.name,
        score
      };
    });
    
    // Sort by score (highest first)
    scores.sort((a, b) => b.score.percentage - a.score.percentage);
    
    displayResults(jobInfo, scores);
    
    // Store job info and scores for later use
    window.currentJobInfo = jobInfo;
    window.currentScores = scores;
    
  } catch (error) {
    console.error('Error analyzing job:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    
    // Show more helpful error message
    const errorElement = document.getElementById('error');
    errorElement.innerHTML = `
      <strong>Could not analyze this page</strong><br>
      <small>Make sure you're on a job posting page. Try refreshing the page and clicking the extension again.</small>
    `;
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  analyzeJob();
  
  document.getElementById('saveToNotion').addEventListener('click', () => {
    if (window.currentJobInfo && window.currentScores && window.currentScores.length > 0) {
      saveToAirtable(window.currentJobInfo, window.currentScores[0]);
    } else if (window.currentJobInfo) {
      // If we have job info but no scores, create a default score
      const defaultResume = { name: 'Software Engineer', score: { percentage: 0 } };
      saveToAirtable(window.currentJobInfo, defaultResume);
    } else {
      alert('No job information available. Please try refreshing or use manual input.');
    }
  });
  
  document.getElementById('refreshScores').addEventListener('click', () => {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    analyzeJob();
  });

  document.getElementById('autofillForm').addEventListener('click', () => {
    if (window.currentJobInfo && window.currentScores && window.currentScores.length > 0) {
      autofillApplicationForm(window.currentJobInfo, window.currentScores[0]);
    } else if (window.currentJobInfo) {
      // If we have job info but no scores, use default resume
      const defaultResume = { name: 'Software Engineer', score: { percentage: 0 } };
      autofillApplicationForm(window.currentJobInfo, defaultResume);
    } else {
      alert('No job information available. Please try refreshing or use manual input.');
    }
  });

  document.getElementById('configureToken').addEventListener('click', () => {
    const apiKey = prompt('Enter your Airtable API Key:\n\nGet it from: https://airtable.com/create/tokens\n\nMake sure it has access to your Job Tracker base.');
    if (apiKey && apiKey.trim()) {
      chrome.storage.local.set({ airtableApiKey: apiKey.trim() }, () => {
        AIRTABLE_CONFIG.apiKey = apiKey.trim();
        updateApiKeyStatus(true);
        alert('API Key saved successfully!');
      });
    }
  });

  document.getElementById('clearToken').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your Airtable API key?')) {
      chrome.storage.local.remove(['airtableApiKey'], () => {
        AIRTABLE_CONFIG.apiKey = '';
        updateApiKeyStatus(false);
        alert('API Key cleared successfully!');
      });
    }
  });

  // Database configuration is not needed for Airtable - it's pre-configured
  document.getElementById('configureDatabase').addEventListener('click', () => {
    const choice = prompt('Choose an option:\n\n1. 🔍 Test Connection\n2. 📋 View Configuration\n\nEnter 1 or 2:');
    
    if (choice === '1') {
      testAirtableConnection();
    } else if (choice === '2') {
      alert('Airtable Configuration:\n\nBase ID: ' + AIRTABLE_CONFIG.baseId + '\nTable ID: ' + AIRTABLE_CONFIG.tableId + '\n\nYou only need to configure your API key.');
    }
  });

  document.getElementById('manualInput').addEventListener('click', () => {
    const title = prompt('Enter Job Title:');
    if (title) {
      const company = prompt('Enter Company Name:');
      if (company) {
        const location = prompt('Enter Location (optional):') || 'Location Not Specified';
        const description = prompt('Enter Job Description (optional):') || 'No description available';
        
        const jobInfo = {
          title: title,
          company: company,
          location: location,
          description: description,
          url: window.location.href
        };
        
        // Calculate scores for all resumes
        const scores = Object.entries(RESUMES).map(([id, resume]) => {
          const score = calculateScore(jobInfo.description, resume.keywords);
          return {
            id,
            name: resume.name,
            score
          };
        });
        
        // Sort by score (highest first)
        scores.sort((a, b) => b.score.percentage - a.score.percentage);
        
        // Hide error and show content
        document.getElementById('error').style.display = 'none';
        displayResults(jobInfo, scores);
        
        // Store job info and scores for later use
        window.currentJobInfo = jobInfo;
        window.currentScores = scores;
      }
    }
  });
});
  
  