// ==UserScript==
// @name         Grok Quota Monitor
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Displays current quota details and renewal timer on Grok pages
// @author       You
// @match        https://grok.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let lastQuotaData = null;

    // Helper to extract credentials natively from active session cookies
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Function to fetch quota data safely using site's own session state
    function fetchQuota() {
        // Grok requires an empty JSON object raw body for this endpoint
        const payload = "{}";

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://grok.com/rest/media/imagine/quota_info",
            headers: {
                "accept": "*/*",
                "content-type": "application/json",
                "origin": "https://grok.com",
                "referer": window.location.href
            },
            data: payload,
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data && data.video720p) {
                        lastQuotaData = data.video720p;
                        updateQuotaUI();
                    }
                } catch (e) {
                    console.error("Failed to parse Grok quota response", e);
                }
            }
        });
    }

    // Function to inject/update the UI component inside Grok's styling framework
    function updateQuotaUI() {
        if (!lastQuotaData) return;

        // Target the video resolution/duration settings ribbon provided in your layout
        const targetContainer = document.querySelector('.query-bar flex.flex-wrap.items-center.gap-1\\.5');
        if (!targetContainer) return;

        // Remove old instance if it exists
        const existingBadge = document.getElementById('grok-quota-monitor-badge');
        if (existingBadge) existingBadge.remove();

        // Parse remaining queries and next available time
        const remaining = lastQuotaData.remainingQueries !== undefined ? lastQuotaData.remainingQueries : "Available";
        let timeString = "";

        if (lastQuotaData.nextAvailableAt) {
            const renewTime = new Date(lastQuotaData.nextAvailableAt);
            const now = new Date();
            const diffMs = renewTime - now;

            if (diffMs > 0) {
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                timeString = `(Renews in ${hours}h ${minutes}m)`;
            } else {
                timeString = "(Renewing...)";
            }
        }

        // Build a UI component utilizing Grok's design framework class rules
        const quotaBadge = document.createElement('div');
        quotaBadge.id = 'grok-quota-monitor-badge';
        quotaBadge.className = 'inline-flex items-center gap-1.5 px-3 text-xs font-medium ring-1 ring-border dark:ring-transparent bg-surface-l2 text-secondary h-8 rounded-2xl select-none';
        quotaBadge.style.color = remaining === 0 ? '#ef4444' : '#10b981'; // Red if empty, green if available
        quotaBadge.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>720p Quota: <strong>${remaining}</strong> <span style="font-size:10px; opacity:0.8; color:gray; margin-left:4px;">${timeString}</span></span>
        `;

        targetContainer.appendChild(quotaBadge);
    }

    // Initialize checking routines
    fetchQuota();
    
    // Periodically update countdowns and re-fetch status every 60 seconds
    setInterval(updateQuotaUI, 15000); 
    setInterval(fetchQuota, 60000);

    // Watch for dynamic page updates or tab shifts to ensure UI stays attached
    const observer = new MutationObserver(() => {
        if (!document.getElementById('grok-quota-monitor-badge')) {
            updateQuotaUI();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
