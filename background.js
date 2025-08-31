chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveJob") {
      console.log("Saving job from", message.url);
    }
  });
  
  