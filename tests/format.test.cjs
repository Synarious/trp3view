const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'format.js'), 'utf8'), context);
const format = (text, mode = 'ingame') => context.window.TRP3.formatTRPText(text, mode);

test('in-game canvas does not inherit Tailwind full-panel width', () => {
    const html = format('{h1:c}About{/h1}');
    assert.match(html, /^<div class="trp-ingame-body">/);
    assert.doesNotMatch(html, /\bw-full\b/);
});

test('banner text retains authored vertical positioning over full-width artwork', () => {
    const html = format('{img:banner:550:238:r}\n\n\n{h1:c}About{/h1}');
    assert.match(html, /trp-ig-backdrop/);
    assert.match(html, /<br><br><br><h1 class="text-center">About<\/h1>/);
    assert.match(html, /width="550" height="238"/);
});

test('portrait and subheading share a row without added float margins', () => {
    const html = format('{img:portrait:256:256:r}{h3}Origin{/h3}First line\nSecond line');
    assert.match(html, /class="trp-ig-img trp-ig-right"/);
    assert.match(html, /<h3 class="text-left">Origin<\/h3>First line<br>Second line/);
    assert.doesNotMatch(html, /trp-ig-backdrop|ml-3|mb-2|w-full text-left/);
});

test('decorative dividers keep their authored length and thickness', () => {
    const html = format('{img:divider:350:5}');
    assert.match(html, /width="350" height="5" style="width:350px;height:5px;"/);
    assert.match(html, /trp-ig-center/);
});

test('colour changes crossing a heading remain balanced inside each block', () => {
    const html = format('{col:B19CFF}{h1:c}Background{/h1}{h3}{col:00fdff}Origin{col:ffeb8a}{/h3}{/col}{col:a99aff}Body{/col}');
    assert.match(html, /<h1 class="text-center"><span style="color:#B19CFF">Background<\/span><\/h1>/);
    assert.match(html, /<h3 class="text-left"><span style="color:#00fdff">Origin<\/span><\/h3>/);
    assert.match(html, /<span style="color:#a99aff">Body<\/span>/);
    assert.doesNotMatch(html, /<span[^>]*><h|<\/h[1-3]><\/span>|\{\/?col/);
});

test('simple view continues to omit images and flow text into paragraphs', () => {
    const html = format('{img:portrait:256:256:r}{h1:c}About{/h1}\n\n{p}First line\nSecond line{/p}', 'simple');
    assert.doesNotMatch(html, /<img|trp-ig-/);
    assert.match(html, /First line Second line/);
});


test('full-width banner reserves its height before the next illustrated section', () => {
    const html = format('{img:banner:550:238:r}\n{h1:c}About{/h1}\n{img:wolf:64:64:l}{h1:c}Background{/h1}');
    assert.match(html, /class="trp-ig-banner" style="min-height:238px"/);
    assert.match(html, /About<\/h1><\/div><img[^>]+width="64"/);
});


test('essential artwork is embedded so PNG export works without remote or file fetches', () => {
    const api = context.window.TRP3;
    assert.match(api.getTextureUrl('Interface/GLUES/LOADINGSCREENS/Expansion09/Main/LoadScreen_MapPirate'), /^data:image\/webp;base64,/);
    assert.match(api.getIconUrl('inv_misc_mask_02'), /^data:image\/jpeg;base64,/);
    assert.match(api.getIconUrl(''), /^data:image\/jpeg;base64,/);
});
