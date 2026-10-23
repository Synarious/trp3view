// ==========================================
// VIEW LAYER
// Modals, tabs, edit mode and the routines
// that paint a parsed profile into the DOM.
// ==========================================

(function () {
    const TRP3 = window.TRP3 = window.TRP3 || {};
    const esc = (value) => TRP3.escapeHtml(value == null ? "" : value);

    let initialized = false;

    // ------------------------------------------------------------------
    // MODALS
    // ------------------------------------------------------------------

    let modalOpener = null;
    function showModal(id) {
        modalOpener = document.activeElement;
        const modal = document.getElementById(id);
        modal?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        (modal?.querySelector('textarea') || modal?.querySelector('button'))?.focus();
    }

    function hideModal(id) {
        document.getElementById(id)?.classList.add('hidden');
        document.body.style.overflow = '';
        modalOpener?.focus();
    }

    function openImportModal() { showModal('importModal'); }
    function closeImportModal() {
        hideModal('importModal');
        document.getElementById('errorMsg')?.classList.add('hidden');
    }
    function openInGameView() { showModal('inGameModal'); }
    function closeInGameView() { hideModal('inGameModal'); }

    function closeMenus(restoreFocus = false) {
        document.querySelectorAll('.dropdown-group.is-open').forEach(group => {
            group.classList.remove('is-open');
            const trigger = group.querySelector('.menu-trigger');
            trigger?.setAttribute('aria-expanded', 'false');
            if (restoreFocus) trigger?.focus();
        });
    }

    // ------------------------------------------------------------------
    // VIEW MODE TABS
    // Styling lives in index.html (.view-tab); here we only toggle state.
    // ------------------------------------------------------------------

    function switchViewMode(mode) {
        TRP3.state.viewMode = mode;

        const toolbar = document.getElementById('aboutToolbar');
        const outAbout = document.getElementById('outAbout');
        if (!outAbout) return;

        document.getElementById('tabSimpleBtn')?.classList.toggle('is-active', mode === 'simple');
        document.getElementById('tabInGameBtn')?.classList.toggle('is-active', mode === 'ingame');
        document.getElementById('tabSimpleBtn')?.setAttribute('aria-pressed', String(mode === 'simple'));
        document.getElementById('tabInGameBtn')?.setAttribute('aria-pressed', String(mode === 'ingame'));
        toolbar?.classList.toggle('ingame-mode', mode === 'ingame');
        outAbout.classList.toggle('paper-texture', mode === 'simple');
        outAbout.classList.toggle('ingame-parchment-dark', mode === 'ingame');
        outAbout.classList.toggle('trp-about-ingame', mode === 'ingame');
        outAbout.classList.toggle('trp-about', mode !== 'ingame');

        applyFontSize();
        fitInGameCanvas(outAbout);

        const p = TRP3.state.profile;
        if (p && p.tokens) {
            outAbout.innerHTML = TRP3.formatTRPText(p.aboutStripped, mode);
        }
    }

    // The in-game view has a fixed type size (it mimics the client frame), so
    // the font control is only meaningful in Simple View.
    function applyFontSize() {
        const outAbout = document.getElementById('outAbout');
        const ingame = TRP3.state.viewMode === 'ingame';

        const controls = document.getElementById('fontControls');
        if (controls) {
            controls.classList.toggle('is-unavailable', ingame);
            controls.setAttribute('aria-hidden', String(ingame));
            controls.inert = ingame;
        }

        if (outAbout) outAbout.style.fontSize = ingame ? '' : (TRP3.state.fontSize || '1rem');
        if (ingame) {
            const slider = document.getElementById('fontSlider');
            if (slider) slider.value = '1.0';
            const display = document.getElementById('fontDisplay');
            if (display) display.textContent = '1.0x';
        }
    }

    // ------------------------------------------------------------------
    // EDIT MODE
    // ------------------------------------------------------------------

    function toggleEditMode() {
        TRP3.state.editMode = !TRP3.state.editMode;
        const btn = document.getElementById('editToggleBtn');
        if (!btn) return;

        btn.setAttribute('aria-pressed', String(TRP3.state.editMode));
        btn.classList.toggle('is-editing', TRP3.state.editMode);
        const label = btn.querySelector('span');
        if (label) label.textContent = TRP3.state.editMode ? 'Done editing' : 'Edit profile';
        document.body.classList.toggle('edit-mode', TRP3.state.editMode);
        const status = document.getElementById('profileStatus');
        if (status) {
            status.textContent = TRP3.state.editMode ? 'Editing' : 'Viewing';
            status.classList.toggle('is-editing', TRP3.state.editMode);
        }
    }

    // Re-parses the token stream after an in-place edit and repaints.
    function commitEdit() {
        const p = TRP3.state.profile;
        TRP3.state.profile = TRP3.parseTRP3Data(p.tokens);
        renderProfile();
    }

    // Replaces a single token and repaints when the value actually changed.
    function applyTokenEdit(index, newValue) {
        const p = TRP3.state.profile;
        if (p.tokens[index] === newValue) return;
        p.tokens[index] = newValue;
        commitEdit();
    }

    function handleDoubleClick(e) {
        if (!TRP3.state.editMode) return;
        const p = TRP3.state.profile;

        const iconEl = e.target.closest('.editable-icon');
        if (iconEl) {
            const idx = iconEl.getAttribute('data-idx');
            if (!idx || idx === "-1") return;

            const currentIcon = p.tokens[idx] || "";
            alert("To change this icon, find the exact texture name at https://www.wowhead.com/icons");
            const newIcon = prompt("Enter exact WoW icon name:", currentIcon);
            if (newIcon !== null && newIcon !== currentIcon) applyTokenEdit(idx, newIcon);
            return;
        }

        const textEl = e.target.closest('.editable-text');
        if (textEl) {
            const idx = textEl.getAttribute('data-idx');
            if (!idx || idx === "-1") return;

            textEl.contentEditable = true;
            textEl.focus();

            const finishEdit = function () {
                textEl.contentEditable = false;
                applyTokenEdit(idx, textEl.innerText.trim());
                textEl.removeEventListener('blur', finishEdit);
            };
            textEl.addEventListener('blur', finishEdit);
            return;
        }

        if (e.target.closest('#outAbout')) {
            const idx = p._meta.aboutIdx;
            if (!idx || idx === -1) return;

            const outAbout = document.getElementById('outAbout');
            const editArea = document.getElementById('editAbout');
            if (!outAbout || !editArea) return;

            outAbout.classList.add('hidden');
            editArea.classList.remove('hidden');
            editArea.value = p.tokens[idx] || p.aboutRaw;
            editArea.focus();

            const finishAboutEdit = function () {
                applyTokenEdit(idx, editArea.value);
                editArea.classList.add('hidden');
                outAbout.classList.remove('hidden');
                editArea.removeEventListener('blur', finishAboutEdit);
            };
            editArea.addEventListener('blur', finishAboutEdit);
        }
    }

    // ------------------------------------------------------------------
    // PROFILE RENDER
    // ------------------------------------------------------------------

    // Pulls the display-ready values out of a parsed profile once, so both
    // the web and in-game views stay consistent.
    function deriveViewModel(p) {
        const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
        const subTitleInfo = [p.race, (p.role || p.class)].filter(Boolean).join(" • ");
        const classColor = TRP3.resolveClassColor(p.class || p.role || "evoker");

        let pronouns = "";
        let nickname = "";
        const attributes = [];

        p.attributes.forEach(attr => {
            const nameLower = (attr.name || "").toLowerCase();
            if (nameLower === "pronouns" || nameLower === "pronoun") {
                pronouns = attr.value;
            } else if (nameLower === "nickname" || nameLower === "nick name" || nameLower === "nicknames") {
                nickname = attr.value;
            } else {
                attributes.push(attr);
            }
        });

        if (nickname) {
            attributes.unshift({ name: "Nickname", value: nickname, icon: "inv_misc_key_03", icIdx: "-1", nameIdx: "-1", valIdx: "-1" });
        }

        return { fullName, subTitleInfo, classColor, pronouns, attributes };
    }

    function renderWebView(p, vm) {
        let displayTitle = `<span class="editable-text" data-idx="${p._meta.firstIdx}">${esc(p.firstName)}</span> <span class="editable-text" data-idx="${p._meta.lastIdx}">${esc(p.lastName)}</span>`;
        if (vm.pronouns) displayTitle += `<span class="pronoun-badge">${esc(vm.pronouns)}</span>`;

        const webName = document.getElementById('outName');
        if (webName) {
            webName.innerHTML = displayTitle;
            webName.style.color = vm.classColor;
        }

        const webIcon = document.getElementById('outIcon');
        if (webIcon) {
            webIcon.src = TRP3.getIconUrl(p.icon || TRP3.getClassIcon(p.class || p.role));
            webIcon.setAttribute('data-idx', p._meta.iconIdx || "-1");
            webIcon.style.borderColor = vm.classColor;
            webIcon.classList.remove('hidden');
        }

        const webTitle = document.getElementById('outTitle');
        if (webTitle) {
            webTitle.innerHTML = `<span class="editable-text" data-idx="${p._meta.titleIdx}">${esc(p.fullTitle)}</span>`;
            webTitle.style.display = p.fullTitle ? "block" : "none";
        }

        const pillsContainer = document.getElementById('outPills');
        if (pillsContainer) {
            pillsContainer.innerHTML = `<span class="text-white text-xs font-medium bg-[var(--box-bg)] inline-flex items-center px-3 py-0.5 rounded-full border border-[var(--box-border)] shadow-inner whitespace-nowrap">${esc(vm.subTitleInfo) || "No identity details"}</span>`;
        }

        const attrContainer = document.getElementById('outAttributes');
        if (attrContainer) {
            attrContainer.innerHTML = vm.attributes.map(attr => `
                    <div class="card-box hover-box">
                        <img crossorigin="anonymous" src="${TRP3.getIconUrl(attr.icon)}" class="w-6 h-6 rounded border border-panel flex-shrink-0 editable-icon" data-idx="${attr.icIdx}" onerror="this.onerror=null;this.src=TRP3.getIconUrl('')">
                        <div class="card-text-wrapper">
                            <span class="card-title-text editable-text" data-idx="${attr.nameIdx}">${esc(attr.name)}</span>
                            <span class="card-value-text editable-text" data-idx="${attr.valIdx}">${esc(attr.value)}</span>
                        </div>
                    </div>`).join('');
        }

        const traitsContainer = document.getElementById('outTraits');
        if (traitsContainer) {
            traitsContainer.innerHTML = p.traits
                .filter(trait => trait.title || trait.text)
                .map(trait => `
                    <div class="card-box hover-box">
                        <img crossorigin="anonymous" src="${TRP3.getIconUrl(trait.icon)}" class="w-8 h-8 rounded border border-panel shadow flex-shrink-0 editable-icon" data-idx="${trait.icIdx}" onerror="this.onerror=null;this.src=TRP3.getIconUrl('')">
                        <div class="card-text-wrapper">
                            <span class="card-title-text editable-text" data-idx="${trait.titleIdx}" style="font-size: 13px;">${esc(trait.title)}</span>
                            <span class="card-value-text editable-text" data-idx="${trait.textIdx}" style="color: var(--text-muted);">${esc(trait.text)}</span>
                        </div>
                    </div>`).join('');
        }

        const pContainer = document.getElementById('personalityContainer');
        const pOutput = document.getElementById('outPersonality');
        if (pOutput && pContainer) {
            pOutput.innerHTML = p.personality.map(pTrait => {
                const percent = TRP3.personalityPercent(pTrait.value);
                return `
                        <div class="flex items-center w-full gap-1.5 py-1">
                            <span class="text-xs text-yellow-500 flex-1 text-right font-medium leading-normal break-words editable-text" data-idx="${pTrait.leftNameIdx}">${esc(pTrait.leftName)}</span>
                            <img crossorigin="anonymous" src="${TRP3.getIconUrl(pTrait.leftIcon)}" class="w-5 h-5 rounded border border-panel shadow flex-shrink-0 editable-icon" data-idx="${pTrait.lIcIdx}">
                            <div class="w-16 sm:w-24 flex h-2.5 rounded-sm overflow-hidden relative border border-panel shadow-inner bg-black flex-shrink-0 cursor-pointer">
                                <div class="bg-gradient-to-r from-yellow-700 to-yellow-500 h-full" style="width: ${percent}%"></div>
                                <div class="bg-gradient-to-r from-blue-700 to-blue-500 h-full" style="width: ${100 - percent}%"></div>
                                <div class="absolute top-0 bottom-0 w-[2px] bg-white shadow left-0" style="margin-left: ${percent}%"></div>
                            </div>
                            <img crossorigin="anonymous" src="${TRP3.getIconUrl(pTrait.rightIcon)}" class="w-5 h-5 rounded border border-panel shadow flex-shrink-0 editable-icon" data-idx="${pTrait.rIcIdx}">
                            <span class="text-xs text-[#3fc7eb] flex-1 text-left font-medium leading-normal break-words editable-text" data-idx="${pTrait.rightNameIdx}">${esc(pTrait.rightName)}</span>
                        </div>`;
            }).join('');
            pContainer.classList.toggle('hidden', p.personality.length === 0);
        }

        switchViewMode(TRP3.state.viewMode);
    }

    function renderInGameView(p, vm) {
        let igDisplayTitle = esc(vm.fullName) || "Unknown Character";
        if (vm.pronouns) igDisplayTitle += ` <span class="opacity-75">(${esc(vm.pronouns)})</span>`;

        const igName = document.getElementById('igName');
        if (igName) igName.innerHTML = igDisplayTitle;

        const igIcon = document.getElementById('igIcon');
        if (igIcon) igIcon.src = TRP3.getIconUrl(p.icon || TRP3.getClassIcon(p.class || p.role));

        const igTitle = document.getElementById('igTitle');
        if (igTitle) igTitle.textContent = p.fullTitle ? `< ${p.fullTitle} >` : "";

        const igAttrBox = document.getElementById('igAttributes');
        if (igAttrBox) {
            igAttrBox.innerHTML = vm.attributes.map(attr => `
                    <div class="flex items-center gap-2">
                        <img crossorigin="anonymous" src="${TRP3.getIconUrl(attr.icon)}" class="w-6 h-6 rounded shadow border border-[#3a2517]">
                        <div class="leading-tight">
                            <span class="block text-[10px] font-bold text-[#f8b700] uppercase tracking-wide">${esc(attr.name)}</span>
                            <span class="block text-xs font-semibold text-[#e2d5c5]">${esc(attr.value)}</span>
                        </div>
                    </div>`).join('');
        }

        const igTraitBox = document.getElementById('igTraits');
        if (igTraitBox) {
            igTraitBox.innerHTML = p.traits
                .filter(trait => trait.title || trait.text)
                .map(trait => `
                    <div class="flex gap-3 mt-4">
                        <img crossorigin="anonymous" src="${TRP3.getIconUrl(trait.icon)}" class="w-8 h-8 rounded shadow border border-[#3a2517] flex-shrink-0">
                        <div class="leading-tight mt-1">
                            <span class="block text-xs font-bold text-[#f8b700] uppercase tracking-wide">${esc(trait.title)}</span>
                            <span class="block text-xs font-medium text-[#c7b299] mt-0.5">${esc(trait.text)}</span>
                        </div>
                    </div>`).join('');
        }

        const igAbout = document.getElementById('igAbout');
        if (igAbout) igAbout.innerHTML = TRP3.formatTRPText(p.aboutStripped, 'ingame');
    }

    function renderProfile() {
        const p = TRP3.state.profile;
        if (!p || !p.tokens) return;
        const heading = document.getElementById('profileHeading');
        if (heading) heading.textContent = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your profile';
        const vm = deriveViewModel(p);
        renderWebView(p, vm);
        renderInGameView(p, vm);
    }

    // ------------------------------------------------------------------
    // HISTORY MENU
    // ------------------------------------------------------------------

    function renderHistoryMenu() {
        const history = TRP3.history.get();
        const list = document.getElementById('historyList');
        if (!list) return;

        if (history.length === 0) {
            list.innerHTML = '<p class="px-4 py-3 text-xs text-[var(--text-muted)] italic">No history yet.</p>';
            return;
        }

        list.innerHTML = history.map((h, i) => `
                <div class="flex items-center border-b border-[var(--box-border)] hover:bg-[var(--box-hover)] group">
                    <a href="#" data-action="history-load" data-index="${i}" class="block px-4 py-2 flex-grow min-w-0">
                        <p class="text-sm font-bold text-[var(--text-accent)] truncate">${esc(h.name)}</p>
                        <p class="text-[10px] text-[var(--text-muted)] truncate">${esc(h.title)}</p>
                    </a>
                    <button data-action="history-view" data-index="${i}" class="px-4 py-2 text-[var(--text-muted)] hover:text-white opacity-50 hover:opacity-100 transition" title="View/Edit Raw String">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>`).join('');
    }

    // Fills the import textarea from a stored history entry, without importing.
    function viewHistoryString(index) {
        const entry = TRP3.history.get()[index];
        if (!entry) return;
        const input = document.getElementById('trpInput');
        if (input) input.value = entry.raw;
        openImportModal();
    }

    // ------------------------------------------------------------------
    // UI BOOTSTRAP
    // ------------------------------------------------------------------

    // One click listener dispatches every [data-action] element, so no
    // handlers need to be exposed on the global window object.
    function dispatchAction(e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        if (el.closest('a[href="#"]')) e.preventDefault();
        const handler = TRP3.actions[el.getAttribute('data-action')];
        if (handler) handler(el, e);
    }

    function fitInGameCanvas(container, contentWidth) {
        if (!container) return;
        if (contentWidth === undefined) {
            const style = getComputedStyle(container);
            contentWidth = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }
        if (contentWidth <= 0) return; // Hidden dialogs are measured on opening.
        container.style.setProperty('--trp-ingame-scale', String(Math.min(1.25, contentWidth / 550)));
    }

    function init() {
        if (initialized) return;
        initialized = true;

        const canvasObserver = new ResizeObserver(entries => {
            for (const entry of entries) fitInGameCanvas(entry.target, entry.contentRect.width);
        });
        for (const id of ['outAbout', 'igAbout']) {
            const container = document.getElementById(id);
            if (container) canvasObserver.observe(container);
        }

        document.getElementById('fontSlider')?.addEventListener('input', function (e) {
            const val = parseFloat(e.target.value).toFixed(1);
            // Simple View only; the in-game view keeps a fixed type size.
            if (TRP3.state.viewMode !== 'ingame') {
                TRP3.state.fontSize = val + 'rem';
                const aboutEl = document.getElementById('outAbout');
                if (aboutEl) aboutEl.style.fontSize = TRP3.state.fontSize;
            }
            const display = document.getElementById('fontDisplay');
            if (display) display.textContent = val + 'x';
        });

        document.addEventListener('dblclick', handleDoubleClick);
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[data-action="toggle-menu"]')) closeMenus();
            dispatchAction(e);
        });
        document.addEventListener('keydown', (e) => {
            const modal = document.querySelector('[role="dialog"]:not(.hidden)');
            if (e.key === 'Escape') {
                closeMenus(true);
                if (modal?.id === 'importModal') closeImportModal();
                if (modal?.id === 'inGameModal') closeInGameView();
            }
            if (e.key === 'Tab' && modal) {
                const controls = [...modal.querySelectorAll('button, textarea, input, a[href], [tabindex="0"]')]
                    .filter(el => el.getClientRects().length && !el.disabled);
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
        });
    }

    // Action registrations owned by the view layer.
    TRP3.actions['toggle-menu'] = (el) => {
        const group = el.closest('.dropdown-group');
        const shouldOpen = !group.classList.contains('is-open');
        closeMenus();
        group.classList.toggle('is-open', shouldOpen);
        el.setAttribute('aria-expanded', String(shouldOpen));
    };
    TRP3.actions['open-import'] = openImportModal;
    TRP3.actions['close-import'] = closeImportModal;
    TRP3.actions['open-ingame'] = openInGameView;
    TRP3.actions['close-ingame'] = closeInGameView;
    TRP3.actions['toggle-edit'] = toggleEditMode;
    TRP3.actions['switch-view'] = (el) => switchViewMode(el.getAttribute('data-view'));
    TRP3.actions['history-load'] = (el) => TRP3.app.loadHistory(Number(el.getAttribute('data-index')));
    TRP3.actions['history-view'] = (el) => viewHistoryString(Number(el.getAttribute('data-index')));

    TRP3.ui = { init, render: renderProfile, renderHistory: renderHistoryMenu, switchViewMode, openImportModal, closeImportModal };
})();
