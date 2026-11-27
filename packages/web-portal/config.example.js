// Copy this file to config.js and fill in your Google Apps Script Web App deployment URLs.
// During CI/CD, GitHub Actions generates config.js automatically from repository secrets.
window.NWM_CONFIG = {
  prod: "https://script.google.com/macros/s/YOUR_PROD_DEPLOYMENT_ID/exec",
  uat: "https://script.google.com/macros/s/YOUR_UAT_DEPLOYMENT_ID/exec"
};
