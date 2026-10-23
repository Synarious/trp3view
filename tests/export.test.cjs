const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createApp(renderer) {
    const alerts = [], downloads = [];
    const button = { disabled: false, setAttribute() {}, removeAttribute() {} };
    const exportClasses = [];
    let removedControls = 0;
    const snapshot = {
        style: {}, classList: { add: name => exportClasses.push(name) },
        querySelectorAll: selector => selector.includes('data-export-ignore')
            ? [{ remove() { removedControls++; } }, { remove() { removedControls++; } }] : []
    };
    const target = { style: { padding: '12px' }, cloneNode: () => snapshot, querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 1000 }) };
    const TRP3 = { state: { profile: { firstName: 'Example' } }, actions: {} };
    const context = {
        window: { TRP3, htmlToImage: renderer }, htmlToImage: renderer,
        console: { error() {}, warn() {} }, alert: message => alerts.push(message),
        document: {
            fonts: { ready: Promise.resolve() }, documentElement: {}, body: { appendChild() {} },
            getElementById: () => target, querySelectorAll: () => [button],
            addEventListener() {}, createElement() { return { style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() { downloads.push(this.download); } }; }
        },
        getComputedStyle: () => ({ getPropertyValue: () => '#101210' }),
        URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} },
        setTimeout: callback => callback()
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), context);
    return { run: TRP3.actions['export-image'], alerts, downloads, button, target, snapshot, exportClasses, removedControls: () => removedControls, context, readImage: TRP3.images.readForExport };
}

test('PNG export survives unavailable fonts, supplies a missing-image fallback and preserves the live layout', async () => {
    let options;
    const app = createApp({
        getFontEmbedCSS: async () => { throw new Error('Blocked font stylesheet'); },
        toBlob: async (target, settings) => { options = settings; return {}; }
    });
    await app.run();
    assert.deepEqual(app.alerts, []);
    assert.deepEqual(app.downloads, ['Example_trp3.png']);
    assert.match(options.imagePlaceholder, /^data:image\//);
    assert.equal(options.fontEmbedCSS, '');
    assert.equal(app.target.style.padding, '12px');
    assert.equal(app.snapshot.style.width, '1280px');
    assert(app.exportClasses.includes('png-export'));
    assert.equal(app.removedControls(), 2);
    assert.equal(app.button.disabled, false);
});

test('PNG rendering errors have readable messages and allow a later retry', async () => {
    let attempts = 0;
    const app = createApp({
        getFontEmbedCSS: async () => '',
        toBlob: async () => { if (++attempts === 1) throw { type: 'error' }; return {}; }
    });
    await app.run();
    assert.match(app.alerts[0], /could not render the profile image/);
    assert.equal(app.button.disabled, false);
    await app.run();
    assert.deepEqual(app.downloads, ['Example_trp3.png']);
});


test('export reuses the loaded image pixels and caches them without another fetch', async () => {
    const app = createApp({});
    let draws = 0;
    app.context.document.createElement = () => ({ getContext: () => ({ drawImage() { draws++; } }), toDataURL: () => 'data:image/png;base64,loaded-pixels' });
    app.context.fetch = () => { throw new Error('Loaded artwork must not be fetched again'); };
    const image = { src: 'https://cdn.example.test/original.png', currentSrc: 'https://cdn.example.test/selected.png', complete: true, naturalWidth: 550, naturalHeight: 238 };
    assert.equal(await app.readImage(image), 'data:image/png;base64,loaded-pixels');
    assert.equal(await app.readImage(image), 'data:image/png;base64,loaded-pixels');
    assert.equal(draws, 1);
});

test('an unexportable wiki image uses the bundled artwork without a network request', async () => {
    const app = createApp({});
    app.context.window.TRP3.bundledImages = { 'assets/textures/loadscreen-mappirate.webp': 'data:image/webp;base64,banner' };
    app.context.document.createElement = () => ({ getContext() { throw new Error('Tainted canvas'); } });
    app.context.fetch = () => { throw new Error('Bundled artwork must not be fetched again'); };
    assert.equal(await app.readImage({ src: 'https://warcraft.wiki.gg/images/Plunderstorm_loading_screen.jpg?test=1', complete: true, naturalWidth: 550, naturalHeight: 238 }), 'data:image/webp;base64,banner');
});


test('export waits for an image already loading instead of fetching it again', async () => {
    const app = createApp({});
    app.context.document.createElement = () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,finished-loading' });
    app.context.fetch = () => { throw new Error('No duplicate image requests'); };
    const image = {
        src: 'https://cdn.example.test/pending.png', complete: false, naturalWidth: 0, naturalHeight: 0,
        async decode() { this.complete = true; this.naturalWidth = 256; this.naturalHeight = 256; }
    };
    assert.equal(await app.readImage(image), 'data:image/png;base64,finished-loading');
});
