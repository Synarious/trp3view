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
            document.getElementById('welcomeScreen')?.classList.add('hidden');
            TRP3.ui.closeImportModal();

            const txtInput = document.getElementById('trpInput');
            if (txtInput) txtInput.value = "";

        } catch (err) {
            console.error(err);
            if (errorMsg) {
                errorMsg.textContent = "Error decoding profile: " + err.message;
                errorMsg.classList.remove('hidden');
            }
            // Keep the current profile visible when a replacement import fails.
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

    // Reuse the actual displayed resource (including responsive currentSrc),
    // rather than forcing an independent network request for every export.
    const exportImageCache = new Map();
    function rememberExportImage(source, data) {
        if (exportImageCache.size >= 64) exportImageCache.delete(exportImageCache.keys().next().value);
        exportImageCache.set(source, data);
        return data;
    }

    async function readImageForExport(image) {
        if (!image.complete && image.decode) {
            try { await image.decode(); } catch (_) { /* Try embedded or cached artwork next. */ }
        }
        const source = image.currentSrc || image.src;
        if (!source) return null;
        if (source.startsWith('data:')) return source;
        if (exportImageCache.has(source)) return exportImageCache.get(source);
        if (image.complete && image.naturalWidth && image.naturalHeight) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                canvas.getContext('2d').drawImage(image, 0, 0);
                const data = canvas.toDataURL('image/png');
                if (data.startsWith('data:image/')) return rememberExportImage(source, data);
            } catch (_) { /* Non-CORS images require an embedded source below. */ }
        }
        const pathname = new URL(source, document.baseURI).pathname.toLowerCase();
        const bundledPath = Object.keys(TRP3.bundledImages || {}).find(path => pathname.endsWith(path.toLowerCase()));
        const legacyBanner = pathname.endsWith('/plunderstorm_loading_screen.jpg');
        const embedded = TRP3.bundledImages?.[bundledPath || (legacyBanner ? 'assets/textures/loadscreen-mappirate.webp' : '')];
        if (embedded) return rememberExportImage(source, embedded);
        try {
            const response = await fetch(source, { mode: 'cors', credentials: 'same-origin', cache: 'force-cache' });
            if (!response.ok) return null;
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) return null;
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return rememberExportImage(source, data);
        } catch (_) { return null; }
    }
    TRP3.images = { readForExport: readImageForExport };

    let imageExportInProgress = false;

    async function exportImage() {
        const p = TRP3.state.profile;
        if (!p || !p.firstName) return alert("Please import a profile first.");
        if (imageExportInProgress) return;
        const target = document.getElementById('outputArea');
        const buttons = [...document.querySelectorAll('[data-action="export-image"]')];
        let downloadUrl;
        let exportHost;
        imageExportInProgress = true;
        buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });

        try {
            if (!window.htmlToImage) throw new Error('The PNG export library did not load. Refresh the page and try again.');
            await document.fonts.ready;
            // Cross-origin font stylesheets may be inaccessible. Preserve embedded
            // fonts where possible, and still export with system fonts otherwise.
            let fontEmbedCSS = '';
            try { fontEmbedCSS = await htmlToImage.getFontEmbedCSS(target); }
            catch (error) { console.warn('PNG export: using available system fonts.', error); }

            const placeholder = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
            const snapshot = target.cloneNode(true);
            const originalImages = [...target.querySelectorAll('img')];
            const imagePairs = new Map([...snapshot.querySelectorAll('img')].map((image, index) => [image, originalImages[index]]));
            snapshot.classList.add('png-export');
            snapshot.querySelectorAll('[data-export-ignore="true"], #aboutToolbar').forEach(node => node.remove());
            const imageRequests = new Map();
            // The library waits for cloned <img> nodes before applying its own
            // missing-image fallback. Embed safe sources first to avoid rejection
            // during that earlier cloning step (including inline onerror retries).
            const images = [...snapshot.querySelectorAll('img')].map(image => {
                const original = imagePairs.get(image);
                const source = original?.currentSrc || (original?.getAttribute('src') ? original.src : '');
                image.removeAttribute('onerror');
                image.removeAttribute('srcset');
                image.removeAttribute('loading');
                image.removeAttribute('crossorigin');
                image.src = placeholder;
                if (!source) return Promise.resolve();
                if (!imageRequests.has(source)) {
                    imageRequests.set(source, readImageForExport(original).then(data => data || placeholder));
                }
                return imageRequests.get(source).then(async data => {
                    image.src = data;
                    try { await image.decode(); }
                    catch (_) { image.src = placeholder; await image.decode(); }
                });
            });
            await Promise.all(images);
            exportHost = document.createElement('div');
            exportHost.setAttribute('aria-hidden', 'true');
            exportHost.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
            snapshot.style.width = '1280px';
            snapshot.style.maxWidth = 'none';
            exportHost.appendChild(snapshot);
            document.body.appendChild(exportHost);

            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--page-grad-edge').trim() || '#0a0604';
            const blob = await htmlToImage.toBlob(snapshot, {
                backgroundColor: bgColor,
                pixelRatio: 2,
                fontEmbedCSS,
                // Failed artwork must not abort the entire profile export.
                imagePlaceholder: placeholder,
                filter: node => !(node.getAttribute && node.getAttribute('data-export-ignore') === 'true')
            });
            if (!blob) throw new Error('The browser could not create a PNG image.');
            downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${p.firstName}_trp3.png`;
            link.href = downloadUrl;
            link.click();
        } catch (error) {
            console.error('Export Error:', error);
            alert('Failed to export image: ' + (error.message || 'The browser could not render the profile image.'));
        } finally {
            // No live layout changes: exports retain the current canvas scale,
            // navigation state, padding, and scroll position, including on failure.
            exportHost?.remove();
            if (downloadUrl) setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            buttons.forEach(button => { button.disabled = false; button.removeAttribute('aria-busy'); });
            imageExportInProgress = false;
        }
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
    });
})();
