# Cookiebot Set Up

Cookiebot is used to manage cookie consent on the Nx website. This document provides instructions for setting up a custom Cookiebot template that aligns with the Nx design system.

Both the pages and app router have the correct setup to grab cookie consent from users. To style the dialog you must do that through the Cookiebot admin interface.

## Template

You can copy the HTML, CSS, and JavaScript from the following template to use in your Cookiebot admin interface.

```html
<div
  id="cookiebanner"
  lang="[#LANGUAGE#]"
  dir="[#TEXTDIRECTION#]"
  ng-non-bindable
>
  <div class="cb-content">
    <p class="cb-text">[#TEXT#]</p>
    <div class="cb-buttons">
      <button
        class="cb-button cb-button-deny"
        id="CybotCookiebotDialogBodyButtonDecline"
      >
        [#DECLINE#]
      </button>
      <button
        class="cb-button cb-button-accept"
        id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"
      >
        [#ACCEPT#]
      </button>
      <button
        class="cb-button cb-button-settings"
        onclick="toggleCookieSettings()"
      >
        [#DETAILS#]
      </button>
    </div>
  </div>

  <!-- Detailed Settings Panel -->
  <div
    id="cookieSettingsPanel"
    class="cb-settings-panel"
    style="display: none;"
  >
    <div class="cb-settings-header">
      <h3 class="cb-settings-title">[#TITLE#]</h3>
      <button
        class="cb-close-button"
        onclick="toggleCookieSettings()"
        aria-label="Close settings"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 1L1 13M1 1L13 13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          ></path>
        </svg>
      </button>
    </div>

    <div class="cb-settings-content">
      <!-- Necessary Cookies (Always On) -->
      <div class="cb-category">
        <div class="cb-category-header">
          <div class="cb-category-info">
            <label class="cb-category-label">
              <input
                type="checkbox"
                id="CybotCookiebotDialogBodyLevelButtonNecessary"
                checked
                disabled
              />
              <span class="cb-toggle">
                <span class="cb-toggle-slider"></span>
              </span>
              <span class="cb-category-name">[#COOKIETYPE_NECESSARY#]</span>
            </label>
          </div>
          <button
            class="cb-category-toggle"
            onclick="toggleCategory('necessary')"
            aria-expanded="false"
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ></path>
            </svg>
          </button>
        </div>
        <div id="necessary-details" class="cb-category-details">
          <p class="cb-category-description">[#COOKIETYPEINTRO_NECESSARY#]</p>
          <div class="cb-cookie-table">[#COOKIETABLE_NECESSARY#]</div>
        </div>
      </div>

      <!-- Preferences -->
      <div class="cb-category">
        <div class="cb-category-header">
          <div class="cb-category-info">
            <label class="cb-category-label">
              <input
                type="checkbox"
                id="CybotCookiebotDialogBodyLevelButtonPreferences"
              />
              <span class="cb-toggle">
                <span class="cb-toggle-slider"></span>
              </span>
              <span class="cb-category-name">[#COOKIETYPE_PREFERENCE#]</span>
            </label>
          </div>
          <button
            class="cb-category-toggle"
            onclick="toggleCategory('preferences')"
            aria-expanded="false"
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ></path>
            </svg>
          </button>
        </div>
        <div id="preferences-details" class="cb-category-details">
          <p class="cb-category-description">[#COOKIETYPEINTRO_PREFERENCE#]</p>
          <div class="cb-cookie-table">[#COOKIETABLE_PREFERENCE#]</div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="cb-category">
        <div class="cb-category-header">
          <div class="cb-category-info">
            <label class="cb-category-label">
              <input
                type="checkbox"
                id="CybotCookiebotDialogBodyLevelButtonStatistics"
              />
              <span class="cb-toggle">
                <span class="cb-toggle-slider"></span>
              </span>
              <span class="cb-category-name">[#COOKIETYPE_STATISTICS#]</span>
            </label>
          </div>
          <button
            class="cb-category-toggle"
            onclick="toggleCategory('statistics')"
            aria-expanded="false"
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ></path>
            </svg>
          </button>
        </div>
        <div id="statistics-details" class="cb-category-details">
          <p class="cb-category-description">[#COOKIETYPEINTRO_STATISTICS#]</p>
          <div class="cb-cookie-table">[#COOKIETABLE_STATISTICS#]</div>
        </div>
      </div>

      <!-- Marketing -->
      <div class="cb-category">
        <div class="cb-category-header">
          <div class="cb-category-info">
            <label class="cb-category-label">
              <input
                type="checkbox"
                id="CybotCookiebotDialogBodyLevelButtonMarketing"
              />
              <span class="cb-toggle">
                <span class="cb-toggle-slider"></span>
              </span>
              <span class="cb-category-name">[#COOKIETYPE_ADVERTISING#]</span>
            </label>
          </div>
          <button
            class="cb-category-toggle"
            onclick="toggleCategory('marketing')"
            aria-expanded="false"
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path
                d="M1 1L6 6L11 1"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ></path>
            </svg>
          </button>
        </div>
        <div id="marketing-details" class="cb-category-details">
          <p class="cb-category-description">[#COOKIETYPEINTRO_ADVERTISING#]</p>
          <div class="cb-cookie-table">[#COOKIETABLE_ADVERTISING#]</div>
        </div>
      </div>

      <!-- Save Selection Button -->
      <div class="cb-settings-footer">
        <button
          class="cb-button cb-button-save"
          id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection"
        >
          [#LEVELOPTIN_ALLOW_SELECTION#]
        </button>
      </div>
    </div>
  </div>
</div>
```

```css
/* Reset and base styles */
#cookiebanner * {
  box-sizing: border-box;
}

/* Main container */
#cookiebanner {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 2147483645;
  width: 520px;
  max-width: calc(100vw - 40px);
  background-color: #0a0a0a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  opacity: 0;
  transform: translateY(20px);
  animation: slideUp 0.3s ease-out forwards;
}

/* Animation */
@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Content wrapper */
.cb-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Text */
.cb-text {
  color: #e5e5e5;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: -0.01em;
}

/* Buttons container */
.cb-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Button base styles */
.cb-button {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  font-family: inherit;
  letter-spacing: -0.01em;
}

/* Deny button */
.cb-button-deny {
  background-color: transparent;
  color: #e5e5e5;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cb-button-deny:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Accept button */
.cb-button-accept {
  background-color: #e5e5e5;
  color: #0a0a0a;
  border: 1px solid #e5e5e5;
}

.cb-button-accept:hover {
  background-color: #ffffff;
  border-color: #ffffff;
}

/* Settings button */
.cb-button-settings {
  background-color: transparent;
  color: #e5e5e5;
  border: 1px solid transparent;
  padding: 8px 20px;
  background-color: rgba(255, 255, 255, 0.1);
}

.cb-button-settings:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

/* Settings Panel */
.cb-settings-panel {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Settings Header */
.cb-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.cb-settings-title {
  color: #e5e5e5;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.cb-close-button {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.cb-close-button:hover {
  color: #e5e5e5;
  background-color: rgba(255, 255, 255, 0.1);
}

/* Settings Content */
.cb-settings-content {
  max-height: 500px;
  overflow-y: auto;
  margin-right: -8px;
  padding-right: 8px;
}

/* Custom scrollbar */
.cb-settings-content::-webkit-scrollbar {
  width: 6px;
}

.cb-settings-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.cb-settings-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.cb-settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Category */
.cb-category {
  margin-bottom: 16px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  overflow: hidden;
}

.cb-category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.cb-category-info {
  flex: 1;
}

.cb-category-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.cb-category-name {
  color: #e5e5e5;
  font-size: 14px;
  font-weight: 500;
  margin-left: 12px;
}

/* Custom Toggle Switch */
.cb-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  transition: background-color 0.2s;
}

.cb-toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background-color: #666;
  border-radius: 50%;
  transition: transform 0.2s, background-color 0.2s;
}

input[type='checkbox'] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

input[type='checkbox']:checked + .cb-toggle {
  background-color: #3291ff;
}

input[type='checkbox']:checked + .cb-toggle .cb-toggle-slider {
  transform: translateX(20px);
  background-color: white;
}

input[type='checkbox']:disabled + .cb-toggle {
  background-color: rgba(255, 255, 255, 0.1);
  cursor: not-allowed;
}

input[type='checkbox']:disabled + .cb-toggle .cb-toggle-slider {
  background-color: #444;
}

/* Category Toggle Button */
.cb-category-toggle {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s;
}

.cb-category-toggle:hover {
  color: #e5e5e5;
}

.cb-category-toggle[aria-expanded='true'] {
  transform: rotate(180deg);
}

/* Category Details */
.cb-category-details {
  display: none;
  padding: 0 16px 16px;
}

.cb-category-details.open {
  display: block;
}

.cb-category-description {
  color: #999;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

/* Cookie Table */
.cb-cookie-table {
  font-size: 12px;
  color: #888;
  overflow-x: auto;
}

.cb-cookie-table table {
  width: 100%;
  border-collapse: collapse;
}

.cb-cookie-table th,
.cb-cookie-table td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.cb-cookie-table th {
  color: #e5e5e5;
  font-weight: 500;
}

.cb-cookie-table a {
  color: #3291ff;
  text-decoration: none;
}

.cb-cookie-table a:hover {
  text-decoration: underline;
}

/* Settings Footer */
.cb-settings-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cb-button-save {
  width: 100%;
  background-color: #3291ff;
  color: white;
  border: 1px solid #3291ff;
  padding: 10px 20px;
}

.cb-button-save:hover {
  background-color: #0070f3;
  border-color: #0070f3;
}

/* Focus styles for accessibility */
.cb-button:focus-visible,
.cb-close-button:focus-visible,
.cb-category-toggle:focus-visible {
  outline: 2px solid #3291ff;
  outline-offset: 2px;
}

/* Mobile responsive */
@media (max-width: 1024px) {
  #cookiebanner {
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    width: 100%;
    max-width: 100%;
    padding: 20px;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
    z-index: 10000;
  }

  .cb-buttons {
    flex-direction: column;
    width: 100%;
  }

  .cb-button {
    width: 100%;
    justify-content: center;
  }

  .cb-settings-content {
    max-height: 300px;
  }
}
```

```javascript
function toggleCookieSettings() {
  var panel = document.getElementById('cookieSettingsPanel');
  var settingsButton = document.querySelector('.cb-button-settings');

  if (panel) {
    if (panel.style.display === 'none' || panel.style.display === '') {
      panel.style.display = 'block';
      if (settingsButton) {
        settingsButton.style.display = 'none';
      }
    } else {
      panel.style.display = 'none';
      if (settingsButton) {
        settingsButton.style.display = 'block';
      }
    }
  }
}

// Toggle category details
function toggleCategory(category) {
  var details = document.getElementById(category + '-details');
  var button = event.currentTarget;

  if (details) {
    if (details.classList.contains('open')) {
      details.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    } else {
      details.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    }
  }
}

// Ensure the banner is visible when Cookiebot shows it
document.addEventListener('DOMContentLoaded', function () {
  // Watch for when Cookiebot displays the banner
  if (window.addEventListener) {
    window.addEventListener('CookiebotOnDialogDisplay', function () {
      var banner = document.getElementById('cookiebanner');
      if (banner) {
        banner.style.display = 'block';
      }
    });
  }
});

// Hide the banner after consent
if (window.addEventListener) {
  window.addEventListener('CookiebotOnAccept', function () {
    hideBanner();
  });

  window.addEventListener('CookiebotOnDecline', function () {
    hideBanner();
  });
}

function hideBanner() {
  var banner = document.getElementById('cookiebanner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(20px)';
    setTimeout(function () {
      banner.style.display = 'none';
    }, 300);
  }
}
```
