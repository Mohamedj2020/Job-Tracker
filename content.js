// Content script for job scraping
// This script runs on job posting pages to help extract job information

console.log('Job Matcher: Content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeJobInfo') {
    const jobInfo = scrapeJobInfo();
    sendResponse(jobInfo);
  }
});

function scrapeJobInfo() {
  // Common selectors for different job sites
  const selectors = {
    title: [
      'h1[class*="title"]',
      'h1[class*="job"]',
      '.job-title',
      '.position-title',
      '[data-testid="job-title"]',
      '[data-automation="job-title"]',
      'h1',
      '.title'
    ],
    company: [
      '[class*="company"]',
      '[class*="employer"]',
      '.company-name',
      '[data-testid="company"]',
      '[data-automation="company"]',
      '.employer'
    ],
    location: [
      '[class*="location"]',
      '.job-location',
      '[data-testid="location"]',
      '[data-automation="location"]',
      '.location'
    ],
    description: [
      '[class*="description"]',
      '.job-description',
      '[data-testid="description"]',
      '[data-automation="description"]',
      '.description',
      '.job-details',
      '.job-summary'
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
