// ==UserScript==
// @name         Grok Quota Display
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Show image/video generation quota and renewal time on Grok pages
// @author       You
// @match        https://grok.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=grok.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const QUOTA_URL = 'https://grok.com/rest/media/imagine/quota_info';

    async function fetchQuota() {
        try {
            const resp = await fetch(QUOTA_URL, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'accept': '*/*',
                    'content-type': 'application/json',
                },
                body: '{}',
            });
            if (!resp.ok) return null;
            return await resp.json();
        } catch {
            return null;
        }
    }

    function formatTimeRemaining(seconds) {
        if (!seconds || seconds <= 0) return null;
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        parts.push(`${m}m`);
        return parts.join(' ');
    }

    function buildDisplay(data) {
        const el = document.createElement('div');
        el.id = 'grok-quota-display';
        Object.assign(el.style, {
            position: 'fixed',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '99999',
            padding: '6px 16px',
            fontSize: '13px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            borderRadius: '0 0 12px 12px',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
            lineHeight: '1.4',
        });

        if (!data || data.error) {
            el.textContent = '⚠ Quota: unavailable';
            return el;
        }

        const quotaGens = data.quotaGenerations ?? data.quota_generations;
        const usedGens = data.numGenerationsThisPeriod ?? data.num_generations_this_period;
        const quotaVids = data.quotaVideoGenerations ?? data.quota_video_generations;
        const usedVids = data.numVideoGenerationsThisPeriod ?? data.num_video_generations_this_period;
        const resetSecs = data.secondsUntilReset ?? data.seconds_until_reset;

        const parts = [];

        if (quotaGens != null) {
            const pct = quotaGens > 0 ? Math.round((usedGens / quotaGens) * 100) : 0;
            parts.push(`🖼 ${usedGens}/${quotaGens} (${pct}%)`);
        }
        if (quotaVids != null) {
            const pct2 = quotaVids > 0 ? Math.round((usedVids / quotaVids) * 100) : 0;
            parts.push(`🎬 ${usedVids}/${quotaVids} (${pct2}%)`);
        }
        const timeStr = formatTimeRemaining(resetSecs);
        if (timeStr) parts.push(`⏰ reset ${timeStr}`);

        el.textContent = parts.join(' · ');

        return el;
    }

    let displayEl = null;

    async function update() {
        const data = await fetchQuota();
        if (!displayEl || !document.body.contains(displayEl)) {
            displayEl = buildDisplay(data);
            document.body.prepend(displayEl);
        } else {
            const newEl = buildDisplay(data);
            displayEl.replaceWith(newEl);
            displayEl = newEl;
        }
    }

    function waitForBody(cb) {
        if (document.body) {
            cb();
        } else {
            requestAnimationFrame(() => waitForBody(cb));
        }
    }

    waitForBody(() => {
        update();
        setInterval(update, 30000);
        const observer = new MutationObserver(() => {
            if (!document.body.contains(displayEl)) {
                update();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();