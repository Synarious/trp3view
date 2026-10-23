// ==========================================
// TEXTURE RESOLVER & TRP3 MARKUP FORMATTER
// Owns everything that turns raw TRP3 markup
// and icon paths into web-renderable output.
// ==========================================

(function () {
    const TRP3 = window.TRP3 = window.TRP3 || {};

    // ------------------------------------------------------------------
    // TEXTURE HOSTS
    // ------------------------------------------------------------------
    // Icons live on Wowhead's zamimg CDN, keyed by icon *name* and
    // case-insensitive, so any casing works.
    const ICON_CDN = 'https://wow.zamimg.com/images/wow/icons/large/';
    const DEFAULT_ICON = ICON_CDN + 'inv_misc_questionmark.jpg';

    // Interface art (banners, backgrounds, frames, atlases) comes from the
    // Gethe/wow-ui-textures git mirror, which converted Blizzard's .blp files
    // to .png while keeping the in-game folder tree. Served via jsDelivr.
    // IMPORTANT: folder and file names are CASE-SENSITIVE on this host.
    const TEXTURE_CDN = 'https://cdn.jsdelivr.net/gh/Gethe/wow-ui-textures@live/';

    // ------------------------------------------------------------------
    // TEXTURE OVERRIDES
    // ------------------------------------------------------------------
    // The mirror froze at 9.2.7, so anything added in Dragonflight or later
    // (e.g. the Expansion09 loading screens) 404s there. Map those paths to a
    // known-good image URL as a stopgap. Keys are the path normalised to
    // lower-case with Interface\ stripped and no extension.
    // See README > "Textures missing from the mirror".
    // NOTE: use the direct /images/ URL, NOT Special:FilePath - the wiki
    // returns 403 to browser user-agents on the redirect endpoint.
    const TEXTURE_OVERRIDES = {
        'glues/loadingscreens/expansion09/main/loadscreen_mappirate':
            'https://warcraft.wiki.gg/images/Plunderstorm_loading_screen.jpg',
    };

    // Normalises a texture path: forward slashes, no leading slash, no
    // Interface\ prefix, no extension. Case is preserved.
    function normalizeTexturePath(texturePath) {
        let clean = texturePath.replace(/\\/g, '/').replace(/^\/+/, '');
        clean = clean.replace(/^interface\//i, '');              // strip leading Interface\
        clean = clean.replace(/\.(png|blp|tga|jpg|jpeg)$/i, ''); // mirror always uses .PNG
        return clean;
    }

    // Returns an override URL for a texture path, or null.
    function getTextureOverride(texturePath) {
        if (!texturePath || typeof texturePath !== 'string') return null;
        const clean = normalizeTexturePath(texturePath);
        return (clean && TEXTURE_OVERRIDES[clean.toLowerCase()]) || null;
    }

    // Resolves a WoW icon name/path to a browser-loadable icon URL.
    function getIconUrl(iconPath) {
        if (!iconPath || typeof iconPath !== 'string') {
            return DEFAULT_ICON;
        }

        // Clean slashes and lowercasing
        let cleanPath = iconPath.replace(/\\/g, '/').toLowerCase();

        // Extract base filename without extension
        let filename = cleanPath.split('/').pop().replace(/\.(png|blp|tga|jpg|jpeg)$/i, '');

        return `${ICON_CDN}${filename}.jpg`;
    }

    // Resolves a WoW interface texture path to its PNG on the wow-ui-textures
    // mirror. The original case is preserved on purpose (the host is
    // case-sensitive). Returns null when the path is unusable.
    //
    //   Interface\QuestionFrame\answer-ChromieScenario-Hourglass
    //     -> <TEXTURE_CDN>QuestionFrame/answer-ChromieScenario-Hourglass.PNG
    function getTextureUrl(texturePath) {
        if (!texturePath || typeof texturePath !== 'string') return null;

        const clean = normalizeTexturePath(texturePath);
        if (!clean) return null;

        const override = TEXTURE_OVERRIDES[clean.toLowerCase()];
        if (override) return override;

        return `${TEXTURE_CDN}${clean}.PNG`;
    }

    // True when a reference actually points at a spell/item icon, which is
    // served by the icon CDN rather than the interface-texture mirror. Only
    // bare names (no path) and paths whose FIRST folder is Icons\ count - an
    // art folder that merely *contains* an Icons subfolder (e.g.
    // PVPFrame\Icons\...) is interface art and lives on the mirror.
    function isIconPath(texturePath) {
        const p = String(texturePath).replace(/\\/g, '/').replace(/^interface\//i, '');
        return !p.includes('/') || /^icons\//i.test(p);
    }

    // Chooses the best URL for a {img:} reference and a fallback to try if it
    // fails to load. Icons go to the icon CDN, everything else to the mirror
    // with the icon CDN as a last resort.
    function resolveImageUrl(texturePath) {
        if (isIconPath(texturePath)) {
            return { src: getIconUrl(texturePath), fallback: DEFAULT_ICON };
        }
        const override = getTextureOverride(texturePath);
        if (override) {
            return { src: override, fallback: DEFAULT_ICON };
        }
        const src = getTextureUrl(texturePath);
        return { src: src || getIconUrl(texturePath), fallback: getIconUrl(texturePath) };
    }

    // Strips characters that could break out of an HTML attribute.
    function attrUrl(url) {
        return String(url == null ? '' : url).replace(/["'<>]/g, '');
    }

    // Inline onerror handler: swap to `fallback` once, then hide the element.
    function fallbackHandler(primary, fallback) {
        if (fallback && fallback !== primary) {
            return `if(!this.dataset.fb){this.dataset.fb=1;this.src='${attrUrl(fallback)}';}else{this.style.display='none';}`;
        }
        return "this.style.display='none';";
    }

    // Escapes angle brackets so raw markup cannot inject HTML.
    function escapeHtml(text) {
        return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Converts inline colour codes and {link} tags shared by both view modes.
    function parseInlineMarkup(text, linkClass) {
        return text
            .replace(/\{col:([0-9a-fA-F]{6})\}/gi, '<span style="color: #$1">')
            .replace(/\{\/col\}/gi, '</span>')
            .replace(/\{link\*(.*?)\*(.*?)\}/gi, `<a href="$1" target="_blank" class="underline ${linkClass}">$2</a>`);
    }

    // Maps a single alignment code (c/r/l) to a Tailwind text alignment class.
    function alignmentClass(code, fallback) {
        if (code && typeof code === 'string' && code.length === 1) {
            const a = code.toLowerCase();
            if (a === 'c') return 'text-center';
            if (a === 'r') return 'text-right';
            if (a === 'l') return 'text-left';
        }
        return fallback;
    }

    // --- SIMPLE VIEW: strips images, flows loose text into clean paragraphs. ---
    function formatSimpleView(text) {
        // 1. Strip images
        text = text.replace(/\{img:[^}]+\}/gi, '');

        // 2. Format headers (centered, tight standardized margins)
        text = text.replace(/\{h([1-3])(?::[crl])?\}([\s\S]*?)\{\/h\1\}/gi, function (match, level, content) {
            const innerText = typeof content === 'string' ? content : '';
            if (!innerText.trim()) return '';
            return `<h${level} class="block w-full text-center mt-4 mb-2 text-xl font-bold text-[var(--text-accent)] border-b border-[var(--box-border)] pb-1">${innerText.trim()}</h${level}>`;
        });

        // 3. Format explicit TRP paragraphs
        text = text.replace(/\{p(?::[crl])?\}([\s\S]*?)\{\/p\}/gi, function (match, align, content) {
            const innerText = typeof content === 'string' ? content : (typeof align === 'string' ? align : '');
            if (!innerText.trim()) return '';
            const flowedText = innerText.trim().replace(/\n+/g, ' ');
            return `<p class="block w-full text-left my-2 leading-relaxed">${flowedText}</p>`;
        });

        // 4. Parse colours and links
        text = parseInlineMarkup(text, 'text-[var(--text-accent)]');

        // 5. Clean up loose text blocks (lines outside {p} tags)
        const blocks = text.split(/\n{2,}/);
        const cleanedBlocks = [];

        for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed || trimmed === '---') continue; // Remove empty gaps & divider lines

            if (/^<(h[1-3]|p|div)/i.test(trimmed)) {
                cleanedBlocks.push(trimmed);
            } else {
                const flowed = trimmed.replace(/\n+/g, ' ');
                cleanedBlocks.push(`<p class="block w-full text-left my-2 leading-relaxed">${flowed}</p>`);
            }
        }

        return `<div class="w-full text-left text-[var(--text-primary)] space-y-2">${cleanedBlocks.join('')}</div>`;
    }

    // --- IN-GAME VIEW: preserves images, custom colours and exact linebreaks. ---
    function formatInGameView(text) {
        text = parseInlineMarkup(text, 'text-blue-400');

        text = text.replace(/\{img:([^:}]+)(?::(\d+))?(?::(\d+))?(?::([lrc]))?\}/gi, function (m, path, w, h, align) {
            // The addon defaults an image's size to 128x128 and, per its
            // IMAGE_PATTERN handling, its alignment to "center" when omitted.
            w = parseInt(w, 10) || 128;
            h = parseInt(h, 10) || 128;

            const a = (align || '').toLowerCase();
            let pos;
            if (a === 'l') pos = 'float-left mr-3 mb-2';
            else if (a === 'r') pos = 'float-right ml-3 mb-2';
            else pos = 'block mx-auto my-2';

            const { src, fallback } = resolveImageUrl(path);
            const url = attrUrl(src);
            const onerr = fallbackHandler(src, fallback);

            return `<img src="${url}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;" class="trp-ig-img max-w-full ${pos}" onerror="${onerr}">`;
        });

        text = text.replace(/\{h([1-3])(?::([crl]))?\}([\s\S]*?)\{\/h\1\}/gi, function (match, level, align, content) {
            const innerText = typeof content === 'string' ? content : (typeof align === 'string' ? align : '');
            // In the WoW client, h1/h2 titles are centered but h3 sub-headings are left-aligned.
            const fallback = level === '3' ? 'text-left' : 'text-center';
            return `<h${level} class="block w-full ${alignmentClass(align, fallback)}">${innerText.trim()}</h${level}>`;
        });

        text = text.replace(/\{p(?::([crl]))?\}([\s\S]*?)\{\/p\}/gi, function (match, align, content) {
            const innerText = typeof content === 'string' ? content : (typeof align === 'string' ? align : '');
            return `<div class="block w-full mb-2 ${alignmentClass(align, 'text-left')}">${innerText.trim()}</div>`;
        });

        text = text.replace(/\n*(<\/?(?:h1|h2|h3|p|div)[^>]*>)\n*/gi, '$1');
        text = text.replace(/\n/g, '<br>');

        // Content is centred in a 550px column, matching the in-game About
        // frame width, so images and text keep the client's proportions.
        return `<div class="trp-ingame-body w-full relative flow-root">${text}</div>`;
    }

    // Formats TRP3 markup for the given view mode ('simple' | 'ingame').
    function formatTRPText(text, mode = 'simple') {
        if (!text) return "<i class='text-[var(--text-muted)]'>No about information provided.</i>";
        text = escapeHtml(text);
        return mode === 'simple' ? formatSimpleView(text) : formatInGameView(text);
    }

    TRP3.getIconUrl = getIconUrl;
    TRP3.getTextureUrl = getTextureUrl;
    TRP3.isIconPath = isIconPath;
    TRP3.resolveImageUrl = resolveImageUrl;
    TRP3.getTextureOverride = getTextureOverride;
    TRP3.setTextureOverride = function (texturePath, url) {
        const clean = normalizeTexturePath(String(texturePath));
        if (clean) TEXTURE_OVERRIDES[clean.toLowerCase()] = url;
    };
    TRP3.formatTRPText = formatTRPText;
    TRP3.escapeHtml = escapeHtml;
})();
