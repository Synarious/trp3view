// ==========================================
// APPLICATION ORCHESTRATION
// Boot sequence, import pipeline, history
// storage and every export format.
// ==========================================

(function () {
    const TRP3 = window.TRP3 = window.TRP3 || {};

    let rawInputString = "";

    // ------------------------------------------------------------------
    // HISTORY STORE
    // Single owner of the persisted history list.
    // ------------------------------------------------------------------

    const HISTORY_KEY = 'trp3_history';
    const HISTORY_LIMIT = 8;

    const historyStore = {
        get() {
            try {
                return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            } catch (e) {
                return [];
            }
        },
        save(list) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        }
    };

    // ------------------------------------------------------------------
    // IMPORT PIPELINE
    // ------------------------------------------------------------------

    function importProfile() {
        const input = document.getElementById('trpInput')?.value;
        if (!input) return;

        rawInputString = input;
        const errorMsg = document.getElementById('errorMsg');
        const outputArea = document.getElementById('outputArea');
        const secondaryNav = document.getElementById('secondaryNav');
        if (errorMsg) errorMsg.classList.add('hidden');

        try {
            let base64 = "";
            const lines = input.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (!line || line.includes("TRP3 PROFILE") || line.includes(": ")) continue;
                base64 += line;
            }

            if (!base64 && input.includes("inventory")) base64 = input;
            else if (!base64) throw new Error("No valid Base64 payload found. Ensure BEGIN/END tags are intact.");

            while (base64.length % 4 !== 0) base64 += '=';

            let decompressed;
            try {
                const binaryStr = window.atob(base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                try { decompressed = pako.inflateRaw(bytes); }
                catch (e) { decompressed = pako.inflate(bytes); }
            } catch (err) {
                decompressed = new Uint8Array(base64.length);
                for (let i = 0; i < base64.length; i++) decompressed[i] = base64.charCodeAt(i) & 0xFF;
            }

            const tokens = TRP3.extractLibSerializeTokens(decompressed);
            const profile = TRP3.parseTRP3Data(tokens);
            TRP3.state.profile = profile;

            const detectedClass = TRP3.detectClassTheme(profile.class || profile.role);
            if (detectedClass) TRP3.applyTheme(detectedClass);

            saveToHistory(profile);
            TRP3.ui.render();

            if (outputArea) outputArea.classList.remove('hidden');
            if (secondaryNav) secondaryNav.classList.remove('hidden');
            TRP3.ui.closeImportModal();

            const txtInput = document.getElementById('trpInput');
            if (txtInput) txtInput.value = "";

        } catch (err) {
            console.error(err);
            if (errorMsg) {
                errorMsg.textContent = "Error decoding profile: " + err.message;
                errorMsg.classList.remove('hidden');
            }
            if (outputArea) outputArea.classList.add('hidden');
            if (secondaryNav) secondaryNav.classList.add('hidden');
        }
    }

    function saveToHistory(profile) {
        const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
        if (!name) return;

        let history = historyStore.get().filter(h => h.name !== name);
        history.unshift({ name, title: profile.fullTitle || "No Title", raw: rawInputString });
        if (history.length > HISTORY_LIMIT) history.pop();

        historyStore.save(history);
        TRP3.ui.renderHistory();
    }

    function loadHistory(index) {
        const entry = historyStore.get()[index];
        if (!entry) return;
        const input = document.getElementById('trpInput');
        if (input) input.value = entry.raw;
        importProfile();
    }

    // ------------------------------------------------------------------
    // EXPORTS
    // ------------------------------------------------------------------

    // Re-encodes the loaded token stream into a pasteable TRP3 string.
    function exportAsTRP3() {
        const p = TRP3.state.profile;
        if (!p || !p.tokens) return alert("Please import a profile first.");
        try {
            const bytes = TRP3.encodeLibSerialize(p.tokens);
            const deflated = pako.deflate(bytes);
            let binaryStr = "";
            for (let i = 0; i < deflated.length; i++) binaryStr += String.fromCharCode(deflated[i]);
            const base64 = btoa(binaryStr);

            let chunked = "";
            for (let i = 0; i < base64.length; i += 80) chunked += base64.substring(i, i + 80) + "\n";
            const finalStr = "!v3!BEGIN\n!TRP3!PROFILE\n" + chunked + "!v3!END";

            navigator.clipboard.writeText(finalStr).then(() => {
                alert("TRP3 Export String generated and copied to clipboard! You can paste this directly into WoW.");
            });
        } catch (e) {
            alert("Failed to export TRP3 string: " + e.message);
        }
    }

    function exportDiscord() {
        const p = TRP3.state.profile;
        if (!p || !p.firstName) return alert("Please import a profile first.");

        let md = `# ${[p.firstName, p.lastName].filter(Boolean).join(" ")}\n`;
        if (p.fullTitle) md += `*${p.fullTitle}*\n`;
        md += `**Race:** ${p.race || 'Unknown'} | **Class:** ${p.class || 'Unknown'}\n\n`;

        if (p.attributes.length > 0) {
            md += `## Basic Information\n`;
            p.attributes.forEach(a => md += `- **${a.name}:** ${a.value}\n`);
            md += `\n`;
        }

        if (p.personality.length > 0) {
            md += `## Personality\n`;
            p.personality.forEach(pTrait => {
                const idx = Math.max(0, Math.min(9, Math.round((TRP3.personalityPercent(pTrait.value) / 100) * 9)));
                const barParts = [];
                for (let j = 0; j < 10; j++) barParts.push(j === idx ? "[x]" : "-");
                md += `- ${pTrait.leftName}   < ${barParts.join(" ")} >   ${pTrait.rightName}\n`;
            });
            md += `\n`;
        }

        if (p.aboutStripped) {
            md += `## About\n`;
            const cleanAbout = p.aboutStripped
                .replace(/\{img:.*?\}/gi, '')
                .replace(/\{col:.*?\}/gi, '').replace(/\{\/col\}/gi, '')
                .replace(/\{h[1-3].*?\}/gi, '\n**').replace(/\{\/h[1-3]\}/gi, '**\n')
                .replace(/\{p.*?\}/gi, '').replace(/\{\/p\}/gi, '\n')
                .replace(/\{link\*(.*?)\*(.*?)\}/gi, '[$2]($1)');
            md += cleanAbout.replace(/\n{3,}/g, '\n\n').trim();
        }

        navigator.clipboard.writeText(md).then(() => alert('Discord Markdown copied to clipboard!'));
    }

    function exportImage() {
        const p = TRP3.state.profile;
        if (!p || !p.firstName) return alert("Please import a profile first.");
        const target = document.getElementById('outputArea');
        const mainNav = document.querySelector('nav');
        const secNav = document.getElementById('secondaryNav');

        if (mainNav) mainNav.style.display = 'none';
        if (secNav) secNav.style.display = 'none';
        window.scrollTo(0, 0);

        const originalPadding = target.style.padding;
        target.style.padding = '40px';

        const restoreChrome = () => {
            target.style.padding = originalPadding;
            if (mainNav) mainNav.style.display = '';
            if (secNav) secNav.style.display = '';
        };

        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--page-grad-edge').trim() || '#0a0604';

        htmlToImage.toPng(target, {
            backgroundColor: bgColor,
            pixelRatio: 2,
            filter: (node) => {
                return !(node.getAttribute && node.getAttribute('data-export-ignore') === 'true');
            }
        }).then(dataUrl => {
            const link = document.createElement('a');
            link.download = `${p.firstName}_trp3.png`;
            link.href = dataUrl;
            link.click();
            restoreChrome();
        }).catch(err => {
            restoreChrome();
            console.error("Export Error:", err);
            alert("Failed to export image: " + err.message);
        });
    }

    // ------------------------------------------------------------------
    // BOOT
    // ------------------------------------------------------------------

    // Action registrations owned by the application layer.
    TRP3.actions['import'] = importProfile;
    TRP3.actions['export-trp3'] = exportAsTRP3;
    TRP3.actions['export-discord'] = exportDiscord;
    TRP3.actions['export-image'] = exportImage;

    TRP3.history = historyStore;
    TRP3.app = { importProfile, loadHistory };

    document.addEventListener("DOMContentLoaded", function () {
        TRP3.ui.init();
        TRP3.applyTheme(localStorage.getItem('trp3_theme') || 'parchment');
        TRP3.ui.renderHistory();
        TRP3.ui.openImportModal();
    });
})();
