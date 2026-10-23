// ==========================================
// THEME PALETTES & CLASS DEFAULTS
// Owns every colour palette and the default
// personality presets shipped in TRP3 data.
// ==========================================

(function () {
    const TRP3 = window.TRP3 = window.TRP3 || {};

    // Shared application state and the delegated action registry.
    // Every module reads/writes state through this single object.
    TRP3.state = TRP3.state || { profile: {}, editMode: false, viewMode: 'simple', fontSize: '1rem' };
    TRP3.actions = TRP3.actions || {};

    TRP3.themes = {
        parchment: { '--page-grad-center': '#2e2014', '--page-grad-edge': '#0a0604', '--panel-bg': '#2a1d12', '--panel-border': '#0f0a06', '--sidebar-bg': '#22160d', '--text-primary': '#e2d5c5', '--text-accent': '#ffd100', '--text-muted': '#c7b299', '--box-bg': '#120b06', '--box-border': '#382618', '--box-hover': '#4a3420', '--about-bg': '#160e09' },
        "death knight": { '--page-grad-center': '#2b090f', '--page-grad-edge': '#0a0204', '--panel-bg': '#1a0509', '--panel-border': '#000000', '--sidebar-bg': '#120306', '--text-primary': '#e0cad0', '--text-accent': '#C41E3A', '--text-muted': '#a87982', '--box-bg': '#0d0204', '--box-border': '#42111a', '--box-hover': '#5c1924', '--about-bg': '#120306' },
        "demon hunter": { '--page-grad-center': '#240a2b', '--page-grad-edge': '#08020a', '--panel-bg': '#16051c', '--panel-border': '#000000', '--sidebar-bg': '#0f0312', '--text-primary': '#dacae0', '--text-accent': '#A330C9', '--text-muted': '#a077ad', '--box-bg': '#0a020d', '--box-border': '#3c124a', '--box-hover': '#531b66', '--about-bg': '#0f0312' },
        "druid": { '--page-grad-center': '#381c04', '--page-grad-edge': '#0d0601', '--panel-bg': '#211002', '--panel-border': '#000000', '--sidebar-bg': '#170b01', '--text-primary': '#f0ded0', '--text-accent': '#FF7C0A', '--text-muted': '#b89476', '--box-bg': '#0d0601', '--box-border': '#4d280b', '--box-hover': '#6e3a12', '--about-bg': '#170b01' },
        "evoker": { '--page-grad-center': '#09241f', '--page-grad-edge': '#020a08', '--panel-bg': '#051714', '--panel-border': '#000000', '--sidebar-bg': '#030f0d', '--text-primary': '#c9e3dd', '--text-accent': '#33937F', '--text-muted': '#77a398', '--box-bg': '#020a08', '--box-border': '#113d34', '--box-hover': '#1b5c4f', '--about-bg': '#030f0d' },
        "hunter": { '--page-grad-center': '#1c290e', '--page-grad-edge': '#060a03', '--panel-bg': '#111a08', '--panel-border': '#000000', '--sidebar-bg': '#0b1205', '--text-primary': '#d1e0c5', '--text-accent': '#ABD473', '--text-muted': '#849e6b', '--box-bg': '#060a03', '--box-border': '#294016', '--box-hover': '#3b5c21', '--about-bg': '#0b1205' },
        "mage": { '--page-grad-center': '#092330', '--page-grad-edge': '#020a0e', '--panel-bg': '#05161f', '--panel-border': '#000000', '--sidebar-bg': '#030e14', '--text-primary': '#cae3f0', '--text-accent': '#3FC7EB', '--text-muted': '#72a0b8', '--box-bg': '#020a0e', '--box-border': '#123f54', '--box-hover': '#1b5b78', '--about-bg': '#030e14' },
        "monk": { '--page-grad-center': '#022919', '--page-grad-edge': '#000a06', '--panel-bg': '#011c11', '--panel-border': '#000000', '--sidebar-bg': '#01120b', '--text-primary': '#c2ebd9', '--text-accent': '#00FF98', '--text-muted': '#6ea890', '--box-bg': '#000a06', '--box-border': '#0a422a', '--box-hover': '#10613e', '--about-bg': '#01120b' },
        "paladin": { '--page-grad-center': '#331322', '--page-grad-edge': '#0d0308', '--panel-bg': '#210c16', '--panel-border': '#000000', '--sidebar-bg': '#14070e', '--text-primary': '#ebd1dc', '--text-accent': '#F48CBA', '--text-muted': '#b38297', '--box-bg': '#0d0308', '--box-border': '#4c1a32', '--box-hover': '#6b2748', '--about-bg': '#14070e' },
        "priest": { '--page-grad-center': '#292929', '--page-grad-edge': '#0a0a0a', '--panel-bg': '#1a1a1a', '--panel-border': '#000000', '--sidebar-bg': '#121212', '--text-primary': '#e3e3e3', '--text-accent': '#FFFFFF', '--text-muted': '#9e9e9e', '--box-bg': '#0a0a0a', '--box-border': '#3d3d3d', '--box-hover': '#595959', '--about-bg': '#121212' },
        "rogue": { '--page-grad-center': '#33300f', '--page-grad-edge': '#0d0c03', '--panel-bg': '#211f0a', '--panel-border': '#000000', '--sidebar-bg': '#141306', '--text-primary': '#ebd8c2', '--text-accent': '#FFF468', '--text-muted': '#ad9f5f', '--box-bg': '#0d0c03', '--box-border': '#4c4714', '--box-hover': '#6b641f', '--about-bg': '#141306' },
        "shaman": { '--page-grad-center': '#05162b', '--page-grad-edge': '#01050d', '--panel-bg': '#030e1c', '--panel-border': '#000000', '--sidebar-bg': '#020912', '--text-primary': '#cad6e8', '--text-accent': '#0070DE', '--text-muted': '#6382a8', '--box-bg': '#01050d', '--box-border': '#0a294d', '--box-hover': '#113e73', '--about-bg': '#020912' },
        "warlock": { '--page-grad-center': '#1b1b30', '--page-grad-edge': '#06060d', '--panel-bg': '#111121', '--panel-border': '#000000', '--sidebar-bg': '#0b0b17', '--text-primary': '#d2d2eb', '--text-accent': '#8788EE', '--text-muted': '#7f80ab', '--box-bg': '#06060d', '--box-border': '#2d2d52', '--box-hover': '#414275', '--about-bg': '#0b0b17' },
        "warrior": { '--page-grad-center': '#291c10', '--page-grad-edge': '#0a0603', '--panel-bg': '#1a110a', '--panel-border': '#000000', '--sidebar-bg': '#120b06', '--text-primary': '#e0d3c5', '--text-accent': '#C79C6E', '--text-muted': '#a38668', '--box-bg': '#0a0603', '--box-border': '#422f1d', '--box-hover': '#5e432a', '--about-bg': '#120b06' },
        alliance: { '--page-grad-center': '#0f1a36', '--page-grad-edge': '#030712', '--panel-bg': '#0a1226', '--panel-border': '#000000', '--sidebar-bg': '#060d1c', '--text-primary': '#d4dffa', '--text-accent': '#f0a800', '--text-muted': '#8ca0cc', '--box-bg': '#02050f', '--box-border': '#162854', '--box-hover': '#203975', '--about-bg': '#060d1c' },
        horde: { '--page-grad-center': '#360c0c', '--page-grad-edge': '#120303', '--panel-bg': '#260808', '--panel-border': '#000000', '--sidebar-bg': '#1c0505', '--text-primary': '#fad4d4', '--text-accent': '#ff2222', '--text-muted': '#cc8c8c', '--box-bg': '#0f0202', '--box-border': '#4a1515', '--box-hover': '#661e1e', '--about-bg': '#1c0505' }
    };

    TRP3.defaults = {
        "1": { leftName: "Chaotic", rightName: "Lawful", leftIcon: "achievement_bg_returnxflags_def_wsg", rightIcon: "spell_holy_blessingofstrength" },
        "2": { leftName: "Forgiving", rightName: "Vindictive", leftIcon: "spell_holy_blessedrecovery", rightIcon: "ability_rogue_nervesofsteel" },
        "3": { leftName: "Truthful", rightName: "Deceitful", leftIcon: "inv_misc_orb_03", rightIcon: "inv_misc_mask_02" },
        "4": { leftName: "Gentle", rightName: "Brutal", leftIcon: "inv_misc_herb_01", rightIcon: "ability_warrior_decisivestrike" },
        "5": { leftName: "Cautious", rightName: "Impulsive", leftIcon: "spell_nature_shamanrage", rightIcon: "spell_fire_incinerate" },
        "6": { leftName: "Ascetic", rightName: "Bon vivant", leftIcon: "inv_misc_food_11", rightIcon: "inv_misc_food_08" },
        "7": { leftName: "Valorous", rightName: "Spineless", leftIcon: "spell_holy_heroism", rightIcon: "ability_hunter_pet_turtle" }
    };

    const KNOWN_CLASSES = ["death knight", "demon hunter", "druid", "evoker", "hunter", "mage", "monk", "paladin", "priest", "rogue", "shaman", "warlock", "warrior"];

    const CLASS_COLORS = {
        "death knight": "#C41E3A", "demon hunter": "#A330C9", "druid": "#FF7C0A",
        "evoker": "#33937F", "hunter": "#ABD473", "mage": "#3FC7EB",
        "monk": "#00FF98", "paladin": "#F48CBA", "priest": "#FFFFFF",
        "rogue": "#FFF468", "shaman": "#0070DE", "warlock": "#8788EE", "warrior": "#C79C6E"
    };

    const CLASS_ICONS = {
        "death knight": "classicon_deathknight", "demon hunter": "classicon_demonhunter", "druid": "classicon_druid",
        "evoker": "classicon_evoker", "hunter": "classicon_hunter", "mage": "classicon_mage",
        "monk": "classicon_monk", "paladin": "classicon_paladin", "priest": "classicon_priest",
        "rogue": "classicon_rogue", "shaman": "classicon_shaman", "warlock": "classicon_warlock", "warrior": "classicon_warrior"
    };

    // Returns the first known class name contained in a free-form string, or null.
    function detectClassTheme(classStr) {
        if (!classStr) return null;
        const c = classStr.toLowerCase();
        for (const cls of KNOWN_CLASSES) {
            if (c.includes(cls)) return cls;
        }
        return null;
    }

    // Resolves a CSS colour for a class / role string.
    function resolveClassColor(className) {
        if (!className) return "var(--text-primary)";
        const c = className.toLowerCase();
        for (const k in CLASS_COLORS) {
            if (c.includes(k)) return CLASS_COLORS[k];
        }
        return "var(--text-primary)";
    }

    // Resolves the WoW class icon token for a class / role string.
    function getClassIcon(className) {
        if (!className) return 'inv_misc_questionmark';
        const c = className.toLowerCase();
        for (const k in CLASS_ICONS) {
            if (c.includes(k)) return CLASS_ICONS[k];
        }
        return 'inv_misc_questionmark';
    }

    // Applies a named palette to the document root and persists the choice.
    function applyTheme(name) {
        const key = name ? name.toLowerCase() : 'parchment';
        const theme = TRP3.themes[key] || TRP3.themes.parchment;
        for (let k in theme) document.documentElement.style.setProperty(k, theme[k]);
        localStorage.setItem('trp3_theme', key);
    }

    TRP3.detectClassTheme = detectClassTheme;
    TRP3.resolveClassColor = resolveClassColor;
    TRP3.getClassIcon = getClassIcon;
    TRP3.applyTheme = applyTheme;
    TRP3.actions['apply-theme'] = (el) => applyTheme(el.getAttribute('data-theme'));
})();
