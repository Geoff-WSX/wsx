const { chromium } = require('playwright');

async function diagnoseTests() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:3006/editor.html', { waitUntil: 'networkidle' });

        const editor = page.locator('#editor');

        // Test heading with detailed logging
        console.log('=== Diagnostic Test for Headings ===');
        await editor.fill('测试标题');
        console.log('After fill, editor value:', await editor.inputValue());

        // Get selection positions before clicking button
        await editor.selectText();
        const start = await editor.evaluate(el => el.selectionStart);
        const end = await editor.evaluate(el => el.selectionEnd);
        console.log('Selection start:', start, 'end:', end);

        // Click H1
        await page.click('button[title="一级标题"]');
        const contentAfterH1 = await editor.inputValue();
        console.log('After H1 click, editor value:', JSON.stringify(contentAfterH1));

        // Check preview
        const preview = await page.locator('#preview').innerHTML();
        console.log('Preview HTML after H1:', preview);

        // Test codeblock more carefully
        console.log('\n=== Diagnostic Test for Codeblock ===');
        await editor.fill('');
        console.log('After fill (empty), editor value:', JSON.stringify(await editor.inputValue()));

        // Get cursor position
        const cursorPos = await editor.evaluate(el => ({ start: el.selectionStart, end: el.selectionEnd }));
        console.log('Cursor position:', cursorPos);

        await page.click('button[title="代码块"]');
        const contentAfterCodeblock = await editor.inputValue();
        console.log('After codeblock click, editor value:', JSON.stringify(contentAfterCodeblock));
        console.log('Expected: ' + JSON.stringify('```\n\n```'));

        // Check if preview shows code block
        const previewCode = await page.locator('#preview').innerHTML();
        console.log('Preview HTML after codeblock:', previewCode);

        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/diagnostic-codeblock.png' });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

diagnoseTests();