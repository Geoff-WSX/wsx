const { chromium } = require('playwright');

async function detailedDiagnostics() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:3006/editor.html', { waitUntil: 'networkidle' });

        // Inject debugging before tests
        await page.evaluate(() => {
            window.debugFormat = window.format;
            window.format = function(type) {
                const editor = Editor.elements.editor;
                console.log('=== FORMAT DEBUG ===');
                console.log('Type:', type);
                console.log('Selection start:', editor.selectionStart, 'end:', editor.selectionEnd);
                console.log('Editor value:', JSON.stringify(editor.value));
                console.log('Selected text:', JSON.stringify(editor.value.substring(editor.selectionStart, editor.selectionEnd)));
                window.debugFormat(type);
                console.log('After format, value:', JSON.stringify(editor.value));
                console.log('===================');
            };
        });

        const editor = page.locator('#editor');

        // Test 1: H1 on selected text
        console.log('\n--- TEST 1: H1 on selected text ---');
        await editor.fill('测试标题');
        await editor.selectText();
        console.log('Before click - Value:', JSON.stringify(await editor.inputValue()));
        await page.click('button[title="一级标题"]');
        console.log('After click - Value:', JSON.stringify(await editor.inputValue()));

        // Test 2: Bold on selected text
        console.log('\n--- TEST 2: Bold on selected text ---');
        await editor.fill('测试文字');
        await editor.selectText();
        console.log('Before click - Value:', JSON.stringify(await editor.inputValue()));
        await page.click('button[title="加粗"]');
        console.log('After click - Value:', JSON.stringify(await editor.inputValue()));

        // Test 3: H1 on empty selection (cursor at end)
        console.log('\n--- TEST 3: H1 on empty selection ---');
        await editor.fill('测试标题');
        // Position cursor at end
        await editor.evaluate(el => {
            el.selectionStart = el.selectionEnd = el.value.length;
        });
        console.log('Cursor position:', await editor.evaluate(el => el.selectionStart));
        console.log('Before click - Value:', JSON.stringify(await editor.inputValue()));
        await page.click('button[title="一级标题"]');
        console.log('After click - Value:', JSON.stringify(await editor.inputValue()));

        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/diagnostic-detailed.png' });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

detailedDiagnostics();