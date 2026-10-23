// ==========================================
// TRP3 DATA CORE
// LibSerialize token codec plus the token
// stream -> profile object parser.
// ==========================================

(function () {
    const TRP3 = window.TRP3 = window.TRP3 || {};

    // ---------------------------------------------------------------------
    // LIB-SERIALIZE ENCODER / DECODER
    // ---------------------------------------------------------------------

    // Splits a LibSerialize byte stream into a token list of strings + numbers.
    function extractLibSerializeTokens(uint8Array) {
        const tokens = [];
        const decoder = new TextDecoder('utf-8');
        let i = 0;
        while (i < uint8Array.length) {
            const byte = uint8Array[i];
            let len = 0, headerSize = 0, isString = false;

            if (byte >= 0x40 && byte <= 0x57) {
                len = byte - 0x40;
                headerSize = 1;
                isString = true;
            } else if (byte === 0x58 && i + 1 < uint8Array.length) {
                len = uint8Array[i + 1];
                headerSize = 2;
                isString = true;
            } else if (byte === 0x59 && i + 2 < uint8Array.length) {
                len = (uint8Array[i + 1] << 8) | uint8Array[i + 2];
                headerSize = 3;
                isString = true;
            } else if (byte === 0x5A && i + 3 < uint8Array.length) {
                len = (uint8Array[i + 1] << 16) | (uint8Array[i + 2] << 8) | uint8Array[i + 3];
                headerSize = 4;
                isString = true;
            }

            if (isString && len > 0 && i + headerSize + len <= uint8Array.length) {
                try {
                    const strBytes = uint8Array.slice(i + headerSize, i + headerSize + len);
                    tokens.push(decoder.decode(strBytes));
                } catch (e) {}
                i += headerSize + len;
            } else if (isString && len === 0) {
                tokens.push("");
                i += headerSize;
            } else {
                tokens.push(byte);
                i++;
            }
        }
        return tokens;
    }

    // Re-encodes a token list back into a LibSerialize byte stream.
    function encodeLibSerialize(tokens) {
        const out = [];
        for (const t of tokens) {
            if (typeof t === 'number') {
                out.push(t);
            } else if (typeof t === 'string') {
                const bytes = new TextEncoder().encode(t);
                const len = bytes.length;
                if (len < 16) {
                    out.push(0x40 + len);
                } else if (len <= 0xFF) {
                    out.push(0x58, len);
                } else if (len <= 0xFFFF) {
                    out.push(0x59, (len >> 8) & 0xFF, len & 0xFF);
                } else if (len <= 0xFFFFFF) {
                    out.push(0x5A, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF);
                }
                for (const b of bytes) out.push(b);
            }
        }
        return new Uint8Array(out);
    }

    // Scans forward for a key token and returns the index of its following value.
    function scanAheadIdx(tokens, startIndex, targetKey, maxLookahead = 15) {
        for (let j = 1; j <= maxLookahead && startIndex + j < tokens.length; j++) {
            if (tokens[startIndex + j] === targetKey) {
                return tokens[startIndex + j + 1] !== undefined ? startIndex + j + 1 : -1;
            }
        }
        return -1;
    }

    // ---------------------------------------------------------------------
    // PROFILE PARSER
    // ---------------------------------------------------------------------

    // Walks the token stream and builds the structured profile object.
    // `_meta` records token indices so edit mode can write values back.
    function parseTRP3Data(tokens) {
        const p = {
            firstName: "", lastName: "", fullTitle: "", race: "", role: "", class: "", icon: "",
            attributes: [], traits: [], personality: [], aboutRaw: "", aboutStripped: "", tokens: tokens, _meta: {}
        };

        let longestStr = "";
        let longestIdx = -1;

        for (let i = 0; i < tokens.length; i++) {
            const s = tokens[i];
            if (typeof s !== 'string') continue;

            if (s.length > longestStr.length) {
                longestStr = s;
                longestIdx = i;
            }

            if (s === "IC" && typeof tokens[i + 1] === "string" && !p.icon && p.attributes.length === 0 && p.traits.length === 0) { p.icon = tokens[i + 1]; p._meta.iconIdx = i + 1; }
            if (s === "FN") { p.firstName = tokens[i + 1]; p._meta.firstIdx = i + 1; }
            if (s === "LN") { p.lastName = tokens[i + 1]; p._meta.lastIdx = i + 1; }
            if (s === "PT" || s === "FT") { p.fullTitle = tokens[i + 1]; p._meta.titleIdx = i + 1; }
            if (s === "RA") { p.race = tokens[i + 1]; p._meta.raceIdx = i + 1; }
            if (s === "CL") { p.class = tokens[i + 1]; p._meta.classIdx = i + 1; }
            if (s === "RO") { p.role = tokens[i + 1]; p._meta.roleIdx = i + 1; }
            if (s === "profileName" && !p.firstName) { p.firstName = tokens[i + 1]; p._meta.firstIdx = i + 1; }

            if (s === "NA") {
                const nIdx = i + 1;
                const vIdx = scanAheadIdx(tokens, i, "VA", 8);
                const icIdx = scanAheadIdx(tokens, i, "IC", 8);
                p.attributes.push({ name: tokens[nIdx], nameIdx: nIdx, value: tokens[vIdx], valIdx: vIdx, icon: tokens[icIdx], icIdx: icIdx });
            }
            if (s === "TI") {
                const tIdx = i + 1;
                const textIdx = scanAheadIdx(tokens, i, "TX", 8);
                const icIdx = scanAheadIdx(tokens, i, "IC", 8);
                p.traits.push({ title: tokens[tIdx], titleIdx: tIdx, text: tokens[textIdx], textIdx: textIdx, icon: tokens[icIdx], icIdx: icIdx });
            }
            if (s === "lN") {
                const lnIdx = i + 1;
                const rnIdx = scanAheadIdx(tokens, i, "rN", 15);
                const lIcIdx = scanAheadIdx(tokens, i, "lI", 15);
                const rIcIdx = scanAheadIdx(tokens, i, "rI", 15);
                const vIdx = scanAheadIdx(tokens, i, "v", 15);
                p.personality.push({
                    leftName: tokens[lnIdx], leftNameIdx: lnIdx, rightName: tokens[rnIdx], rightNameIdx: rnIdx,
                    leftIcon: tokens[lIcIdx], lIcIdx: lIcIdx, rightIcon: tokens[rIcIdx], rIcIdx: rIcIdx,
                    value: tokens[vIdx], valIdx: vIdx
                });
            }
            if (TRP3.defaults[s]) {
                const vIdx = i + 1;
                const val = tokens[vIdx];
                if (typeof val === "number" && val >= 0 && val <= 4) {
                    p.personality.push({ ...TRP3.defaults[s], value: val, valIdx: vIdx });
                }
            }
        }

        // The longest string in the payload is the about text.
        p.aboutRaw = longestStr;
        p._meta.aboutIdx = longestIdx;

        let cleanedAbout = p.aboutRaw;
        const btxyIdx = cleanedAbout.indexOf('BTXY');
        if (btxyIdx !== -1) {
            cleanedAbout = cleanedAbout.substring(btxyIdx + 4).replace(/^[^a-zA-Z0-9{[(<"]+/, '');
        }
        p.aboutStripped = cleanedAbout.trim();

        // De-duplicate repeated entries gathered by look-ahead scanning.
        p.attributes = p.attributes.filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i);
        p.traits = p.traits.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);
        p.personality = p.personality.filter((v, i, a) => a.findIndex(t => (t.leftName === v.leftName)) === i);

        return p;
    }

    // ---------------------------------------------------------------------
    // PERSONALITY VALUE HELPERS
    // ---------------------------------------------------------------------

    // Normalizes a stored personality value (0-4 scale or 0-100) to a percentage.
    // Shared by the on-screen bars and the Discord export.
    function personalityPercent(value) {
        const val = parseFloat(value);
        if (isNaN(val)) return 50;
        if (val >= 0 && val <= 4) return (val / 4) * 100;
        if (val > 4 && val <= 100) return val;
        return 50;
    }

    TRP3.extractLibSerializeTokens = extractLibSerializeTokens;
    TRP3.encodeLibSerialize = encodeLibSerialize;
    TRP3.scanAheadIdx = scanAheadIdx;
    TRP3.parseTRP3Data = parseTRP3Data;
    TRP3.personalityPercent = personalityPercent;
})();
