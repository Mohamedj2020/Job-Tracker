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

// Notion configuration
const NOTION_CONFIG = {
  token: 'YOUR_NOTION_INTEGRATION_TOKEN',
  databaseId: 'YOUR_DATABASE_ID'
};

// Scoring function
function calculateScore(jobText, resumeKeywords) {
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
        // Common selectors for job sites
        const selectors = {
          title: [
            'h1[class*="title"]',
            'h1[class*="job"]',
            '.job-title',
            '.position-title',
            '[data-testid="job-title"]',
            'h1'
          ],
          company: [
            '[class*="company"]',
            '[class*="employer"]',
            '.company-name',
            '[data-testid="company"]'
          ],
          location: [
            '[class*="location"]',
            '.job-location',
            '[data-testid="location"]'
          ],
          description: [
            '[class*="description"]',
            '.job-description',
            '[data-testid="description"]',
            '.description'
          ]
        };
        
        function findText(selectors) {
          for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return '';
        }
        
        const title = findText(selectors.title);
        const company = findText(selectors.company);
        const location = findText(selectors.location);
        const description = findText(selectors.description);
        
        // Fallback: try to get any text content
        const allText = document.body.textContent || '';
        
        return {
          title: title || 'Job Title Not Found',
          company: company || 'Company Not Found',
          location: location || 'Location Not Found',
          description: description || allText.substring(0, 2000),
          url: window.location.href
        };
      }
    });
    
    return results[0].result;
  } catch (error) {
    console.error('Error scraping job info:', error);
    throw error;
  }
}

// Save to Notion
async function saveToNotion(jobInfo, bestResume) {
  if (NOTION_CONFIG.token === 'YOUR_NOTION_INTEGRATION_TOKEN') {
    alert('Please configure your Notion integration token and database ID first!');
    return;
  }
  
  try {
    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_CONFIG.databaseId },
        properties: {
          'Title': {
            title: [{ text: { content: jobInfo.title } }]
          },
          'Company': {
            rich_text: [{ text: { content: jobInfo.company } }]
          },
          'Status': {
            select: { name: 'Applied' }
          },
          'Link': {
            url: jobInfo.url
          },
          'Resume Used': {
            rich_text: [{ text: { content: bestResume.name } }]
          },
          'Match Score': {
            number: bestResume.score.percentage
          },
          'Application Date': {
            date: { start: new Date().toISOString() }
          }
        }
      })
    });
    
    if (response.ok) {
      alert('Job saved to Notion successfully!');
    } else {
      throw new Error('Failed to save to Notion');
    }
  } catch (error) {
    console.error('Error saving to Notion:', error);
    alert('Error saving to Notion. Please check your configuration.');
  }
}

// Display results
function displayResults(jobInfo, scores) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  
  // Update job info
  document.getElementById('jobTitle').textContent = jobInfo.title;
  document.getElementById('company').textContent = jobInfo.company;
  document.getElementById('location').textContent = jobInfo.location;
  
  // Display resume scores
  const scoresContainer = document.getElementById('resumeScores');
  scoresContainer.innerHTML = '';
  
  scores.forEach(score => {
    const scoreElement = document.createElement('div');
    scoreElement.className = `resume-score score-${score.grade.toLowerCase()}`;
    
    const missingKeywords = getMissingKeywords(jobInfo.description, RESUMES[score.id].keywords);
    
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
  });
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
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  analyzeJob();
  
  document.getElementById('saveToNotion').addEventListener('click', () => {
    if (window.currentJobInfo && window.currentScores.length > 0) {
      saveToNotion(window.currentJobInfo, window.currentScores[0]);
    }
  });
  
  document.getElementById('refreshScores').addEventListener('click', () => {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    analyzeJob();
  });
});
  
  