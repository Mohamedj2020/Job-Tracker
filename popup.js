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

// Notion configuration - Load from Chrome storage
let NOTION_CONFIG = {
  token: '',
  databaseId: '' // Will be loaded from storage or set manually
};

// Load Notion token and database ID from Chrome storage
chrome.storage.local.get(['notionToken', 'notionDatabaseId'], (result) => {
  if (result.notionToken) {
    NOTION_CONFIG.token = result.notionToken;
    updateTokenStatus(true);
  } else {
    updateTokenStatus(false);
  }
  
  if (result.notionDatabaseId) {
    NOTION_CONFIG.databaseId = result.notionDatabaseId;
    updateDatabaseStatus(true);
  } else {
    updateDatabaseStatus(false);
  }
});

// Update token status display
function updateTokenStatus(configured) {
  const statusElement = document.getElementById('tokenStatus');
  const buttonElement = document.getElementById('configureToken');
  const clearButton = document.getElementById('clearToken');
  
  if (configured) {
    statusElement.innerHTML = '✅ Token configured';
    statusElement.style.color = '#28a745';
    buttonElement.textContent = 'Change Token';
    clearButton.style.display = 'block';
  } else {
    statusElement.innerHTML = '❌ Token not configured';
    statusElement.style.color = '#dc3545';
    buttonElement.textContent = 'Configure Token';
    clearButton.style.display = 'none';
  }
}

// Update database status display
function updateDatabaseStatus(configured) {
  const statusElement = document.getElementById('databaseStatus');
  const buttonElement = document.getElementById('configureDatabase');
  
  if (configured) {
    statusElement.innerHTML = '✅ Database ID configured';
    statusElement.style.color = '#28a745';
    buttonElement.textContent = 'Change Database ID';
  } else {
    statusElement.innerHTML = '❌ Database ID not configured';
    statusElement.style.color = '#dc3545';
    buttonElement.textContent = 'Configure Database ID';
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

// Test database connection
async function testDatabaseConnection(databaseId) {
  if (!NOTION_CONFIG.token) {
    alert('Please configure your token first!');
    return;
  }
  
  // Format the database ID properly
  let formattedId = databaseId;
  if (databaseId.length === 32) {
    // Add hyphens to format as UUID
    formattedId = databaseId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
  
  console.log('Testing database connection with ID:', formattedId);
  
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${formattedId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });
    
    if (response.ok) {
      const database = await response.json();
      console.log('Database connection successful:', database);
      alert('✅ Database connection successful!\n\nDatabase: ' + database.title[0].text.content);
    } else {
      const errorData = await response.text();
      console.error('Database test failed:', errorData);
      
      if (response.status === 404) {
        alert('❌ Database not found!\n\nPlease check:\n1. Database ID is correct\n2. Integration has access to the database\n3. Database exists and is shared with your integration');
      } else if (response.status === 401) {
        alert('❌ Invalid token!\n\nPlease check your Notion integration token.');
      } else if (response.status === 403) {
        alert('❌ Access denied!\n\nPlease make sure your integration has permission to access the database.');
      } else {
        alert('❌ Connection failed!\n\nError: ' + response.status + ' ' + response.statusText);
      }
    }
  } catch (error) {
    console.error('Error testing database connection:', error);
    alert('❌ Connection error!\n\n' + error.message);
  }
}

// Get database structure to verify column names
async function getDatabaseStructure() {
  if (!NOTION_CONFIG.token) {
    return null;
  }
  
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONFIG.databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });
    
    if (response.ok) {
      const database = await response.json();
      console.log('Database structure:', database.properties);
      return database.properties;
    }
  } catch (error) {
    console.error('Error getting database structure:', error);
  }
  return null;
}

// Save to Notion
async function saveToNotion(jobInfo, bestResume) {
  if (!NOTION_CONFIG.token) {
    alert('Please configure your Notion integration token first! Click "Configure Token" to set it up.');
    return;
  }
  
  if (!NOTION_CONFIG.databaseId) {
    alert('Please configure your Notion database ID first! Click "Configure Database ID" to set it up.');
    return;
  }
  
  // Format the database ID properly
  let formattedId = NOTION_CONFIG.databaseId;
  if (NOTION_CONFIG.databaseId.length === 32) {
    // Add hyphens to format as UUID
    formattedId = NOTION_CONFIG.databaseId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
  
  console.log('Saving to database with ID:', formattedId);
  
  try {
    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: formattedId },
        properties: {
          'Company': {
            title: [{ text: { content: jobInfo.company } }]
          },
          'Job Link': {
            url: jobInfo.url
          },
          'Status': {
            select: { name: 'Applied' }
          },
          'Contact Name': {
            rich_text: [{ text: { content: 'Auto-filled by Job Matcher' } }]
          },
          'Contact Email': {
            rich_text: [{ text: { content: 'Auto-filled by Job Matcher' } }]
          },
          'Last Communication': {
            date: { start: new Date().toISOString() }
          },
          'Salary': {
            rich_text: [{ text: { content: 'Not specified' } }]
          },
          'Rating': {
            number: bestResume.score.percentage
          }
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Successfully saved to Notion:', result);
      alert('✅ Job saved to Notion successfully!\n\nCheck your Application Tracker database for the new entry.');
    } else {
      const errorData = await response.text();
      console.error('Notion API error:', errorData);
      
      let errorMessage = `Failed to save to Notion: ${response.status} ${response.statusText}`;
      
      if (response.status === 404) {
        errorMessage = 'Database not found. Please check your database ID and make sure your integration has access to the database.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid token. Please check your Notion integration token.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please make sure your integration has permission to access the database.';
      }
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error saving to Notion:', error);
    alert(`Error saving to Notion: ${error.message}\n\nPlease check your token and database permissions.`);
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
      saveToNotion(window.currentJobInfo, window.currentScores[0]);
    } else if (window.currentJobInfo) {
      // If we have job info but no scores, create a default score
      const defaultResume = { name: 'Software Engineer', score: { percentage: 0 } };
      saveToNotion(window.currentJobInfo, defaultResume);
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
    const token = prompt('Enter your Notion Integration Token:');
    if (token && token.trim()) {
      chrome.storage.local.set({ notionToken: token.trim() }, () => {
        NOTION_CONFIG.token = token.trim();
        updateTokenStatus(true);
        alert('Token saved successfully!');
      });
    }
  });

  document.getElementById('clearToken').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your Notion token?')) {
      chrome.storage.local.remove(['notionToken'], () => {
        NOTION_CONFIG.token = '';
        updateTokenStatus(false);
        alert('Token cleared successfully!');
      });
    }
  });

  document.getElementById('configureDatabase').addEventListener('click', () => {
    const choice = prompt('Choose how to get your Database ID:\n\n1. Enter manually\n2. Get from current Notion page\n\nEnter 1 or 2:');
    
    if (choice === '1') {
      const databaseId = prompt('Enter your Notion Database ID:\n\nFrom your URL: https://www.notion.so/Application-Tracker-1aa904c944e681eb80d2fd4dc7bc098a\n\nCopy this part: 1aa904c944e681eb80d2fd4dc7bc098a\n\n(Just paste it as-is, the extension will format it automatically)');
      if (databaseId && databaseId.trim()) {
        chrome.storage.local.set({ notionDatabaseId: databaseId.trim() }, () => {
          NOTION_CONFIG.databaseId = databaseId.trim();
          updateDatabaseStatus(true);
          testDatabaseConnection(databaseId.trim());
        });
      }
    } else if (choice === '2') {
      // Try to get database ID from current Notion page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        if (url.includes('notion.so')) {
          const match = url.match(/Application-Tracker-([a-f0-9]{32})/);
          if (match) {
            const databaseId = match[1];
            chrome.storage.local.set({ notionDatabaseId: databaseId }, () => {
              NOTION_CONFIG.databaseId = databaseId;
              updateDatabaseStatus(true);
              testDatabaseConnection(databaseId);
            });
          } else {
            alert('Could not find database ID in current URL. Please make sure you are on your Application Tracker database page.');
          }
        } else {
          alert('Please navigate to your Application Tracker database page first, then try again.');
        }
      });
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
  
  