const { chromium } = require('playwright');

async function directCallDiagnostics() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    // Capture console logs
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    try {
        await page.goto('http://localhost:3006/editor.html', { waitUntil: 'networkidle' });

        const editor = page.locator('#editor');

        // Test: Call format directly via page evaluate
        console.log('\n--- Direct format call test ---');
        await editor.fill('测试标题');

        // Select all text
        await editor.evaluate(el => {
            el.selectionStart = 0;
            el.selectionEnd = el.value.length;
        });
        console.log('Before format call - Value:', JSON.stringify(await editor.inputValue()));
        console.log('Selection:', await editor.evaluate(el => `${el.selectionStart}-${el.selectionEnd}`));

        // Call format directly in page context
        await page.evaluate(() => {
            console.log('Calling format("h1") directly...');
            console.log('Editor value before:', JSON.stringify(document.getElementById('editor').value));
            console.log('Selection before:', document.getElementById('editor').selectionStart + '-' + document.getElementById('editor').selectionEnd);
            format('h1');
            console.log('Editor value after:', JSON.stringify(document.getElementById('editor').value));
        });

        console.log('After format call - Value:', JSON.stringify(await editor.inputValue()));

        // Print any console logs from the page
        console.log('\n--- Page Console Logs ---');
        logs.forEach(l => console.log(l));

        // Test bold as comparison
        console.log('\n--- Direct bold call test ---');
        await editor.fill('测试文字');
        await editor.evaluate(el => {
            el.selectionStart = 0;
            el.selectionEnd = el.value.length;
        });
        console.log('Before format call - Value:', JSON.stringify(await editor.inputValue()));

        await page.evaluate(() => {
            console.log('Calling format("bold") directly...');
            format('bold');
            console.log('Editor value after:', JSON.stringify(document.getElementById('editor').value));
        });

        console.log('After format call - Value:', JSON.stringify(await editor.inputValue()));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

directCallDiagnostics();