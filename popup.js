document.addEventListener("DOMContentLoaded", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById("link").value = tab.url;
  
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
  });
  