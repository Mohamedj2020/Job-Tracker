// Tab switching functionality
function showTab(tabName, clickedElement) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Remove active class from all tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Show selected tab content
  document.getElementById(tabName + '-tab').classList.add('active');
  
  // Add active class to clicked tab
  if (clickedElement) {
    clickedElement.classList.add('active');
  }
}

// Make showTab function globally available
window.showTab = showTab;

document.addEventListener("DOMContentLoaded", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById("link").value = tab.url;

  // Job tracking functionality
  document.getElementById("saveJob").addEventListener("click", () => {
    const job = {
      title: document.getElementById("jobTitle").value,
      company: document.getElementById("company").value,
      link: document.getElementById("link").value,
      status: "Applied"
    };

    console.log("Job to save:", job);

    // TODO: send this job data to Notion API
    alert("Job saved (demo). Check console for details.");
  });

  // Resume functionality
  const resumeFileInput = document.getElementById("resumeFile");
  const resumeContent = document.getElementById("resumeContent");
  const resumeName = document.getElementById("resumeName");

  // Handle file upload
  resumeFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        resumeContent.value = e.target.result;
        if (!resumeName.value) {
          resumeName.value = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        }
        showPreview();
      };
      reader.readAsText(file);
    }
  });

  // Handle text content changes
  resumeContent.addEventListener("input", showPreview);

  // Save resume
  document.getElementById("saveResume").addEventListener("click", () => {
    const resumeData = {
      name: resumeName.value,
      content: resumeContent.value,
      timestamp: new Date().toISOString()
    };

    if (!resumeData.name || !resumeData.content) {
      alert("Please enter both resume name and content!");
      return;
    }

    // Save to Chrome storage
    chrome.storage.local.get(['resumes'], (result) => {
      const resumes = result.resumes || {};
      resumes[resumeData.name] = resumeData;
      
      chrome.storage.local.set({ resumes: resumes }, () => {
        alert(`Resume "${resumeData.name}" saved successfully!`);
        console.log("Resume saved:", resumeData);
      });
    });
  });

  // Load resume
  document.getElementById("loadResume").addEventListener("click", () => {
    chrome.storage.local.get(['resumes'], (result) => {
      const resumes = result.resumes || {};
      const resumeNames = Object.keys(resumes);
      
      if (resumeNames.length === 0) {
        alert("No saved resumes found!");
        return;
      }

      // Create a simple dropdown for resume selection
      const selectedName = prompt("Enter resume name to load:\n\nAvailable resumes:\n" + resumeNames.join("\n"));
      
      if (selectedName && resumes[selectedName]) {
        const resume = resumes[selectedName];
        resumeName.value = resume.name;
        resumeContent.value = resume.content;
        showPreview();
        alert(`Resume "${selectedName}" loaded successfully!`);
      }
    });
  });

  // Show preview function
  function showPreview() {
    const preview = document.getElementById("resumePreview");
    const previewContent = document.getElementById("previewContent");
    const content = resumeContent.value;
    
    if (content.trim()) {
      previewContent.textContent = content.substring(0, 200) + (content.length > 200 ? "..." : "");
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  }

  // Initial preview check
  showPreview();
});
  