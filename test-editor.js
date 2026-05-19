const { chromium } = require('playwright');

async function runTests() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    const results = {
        timestamp: new Date().toISOString(),
        tests: []
    };

    // Helper to add test result
    function addResult(name, status, details = '') {
        results.tests.push({ name, status, details });
        console.log(`[${status}] ${name}: ${details}`);
    }

    try {
        // Navigate to editor
        console.log('Opening editor...');
        await page.goto('http://localhost:3006/editor.html', { waitUntil: 'networkidle' });
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/01-initial-load.png' });
        addResult('Page Load', 'PASS', 'Editor loaded successfully');

        // Test 1: Enter text and select it
        console.log('\n=== Test: Text Entry and Selection ===');
        const editor = page.locator('#editor');
        await editor.fill('测试文字');
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/02-text-entered.png' });

        // Select all text
        await editor.selectText();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/03-text-selected.png' });
        addResult('Text Entry', 'PASS', 'Text entered and selected');

        // Test 2: Bold button
        console.log('\n=== Test: Bold Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="加粗"]');
        let content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/04-bold-applied.png' });
        if (content.includes('**测试文字**')) {
            addResult('Bold Apply', 'PASS', 'Text wrapped with ** markers');
        } else {
            addResult('Bold Apply', 'FAIL', `Expected **测试文字**, got: ${content}`);
        }

        // Toggle bold off
        await editor.selectText();
        await page.click('button[title="加粗"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/05-bold-removed.png' });
        if (!content.includes('**')) {
            addResult('Bold Toggle Off', 'PASS', 'Bold markers removed');
        } else {
            addResult('Bold Toggle Off', 'FAIL', `Bold markers still present: ${content}`);
        }

        // Test 3: Italic button
        console.log('\n=== Test: Italic Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="斜体"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/06-italic-applied.png' });
        if (content.includes('*测试文字*') && !content.includes('**')) {
            addResult('Italic Apply', 'PASS', 'Text wrapped with * markers');
        } else {
            addResult('Italic Apply', 'FAIL', `Expected *测试文字*, got: ${content}`);
        }

        // Toggle italic off
        await editor.selectText();
        await page.click('button[title="斜体"]');
        content = await editor.inputValue();
        if (!content.includes('*测试文字*')) {
            addResult('Italic Toggle Off', 'PASS', 'Italic markers removed');
        } else {
            addResult('Italic Toggle Off', 'FAIL', `Italic markers still present: ${content}`);
        }

        // Test 4: Strikethrough button
        console.log('\n=== Test: Strikethrough Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="删除线"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/07-strike-applied.png' });
        if (content.includes('~~测试文字~~')) {
            addResult('Strikethrough Apply', 'PASS', 'Text wrapped with ~~ markers');
        } else {
            addResult('Strikethrough Apply', 'FAIL', `Expected ~~测试文字~~, got: ${content}`);
        }

        // Test 5: Underline button
        console.log('\n=== Test: Underline Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="下划线"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/08-underline-applied.png' });
        if (content.includes('__测试文字__')) {
            addResult('Underline Apply', 'PASS', 'Text wrapped with __ markers');
        } else {
            addResult('Underline Apply', 'FAIL', `Expected __测试文字__, got: ${content}`);
        }

        // Test 6: Highlight button
        console.log('\n=== Test: Highlight Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="高亮"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/09-highlight-applied.png' });
        if (content.includes('==测试文字==')) {
            addResult('Highlight Apply', 'PASS', 'Text wrapped with == markers');
        } else {
            addResult('Highlight Apply', 'FAIL', `Expected ==测试文字==, got: ${content}`);
        }

        // Test 7: Inline code button
        console.log('\n=== Test: Inline Code Button ===');
        await editor.fill('测试文字');
        await editor.selectText();
        await page.click('button[title="行内代码"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/10-code-applied.png' });
        if (content.includes('`测试文字`')) {
            addResult('Inline Code Apply', 'PASS', 'Text wrapped with ` markers');
        } else {
            addResult('Inline Code Apply', 'FAIL', `Expected \`测试文字\`, got: ${content}`);
        }

        // Test 8: Line-level formats (empty line)
        console.log('\n=== Test: Line-Level Formats ===');
        await editor.fill('');
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/11-empty-editor.png' });

        // Code block
        await page.click('button[title="代码块"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/12-codeblock-added.png' });
        if (content.includes('```\n\n```')) {
            addResult('Code Block Add', 'PASS', 'Code block markers added');
        } else {
            addResult('Code Block Add', 'FAIL', `Expected code block, got: ${content}`);
        }

        // Toggle code block off
        await page.click('button[title="代码块"]');
        content = await editor.inputValue();
        if (!content.includes('```')) {
            addResult('Code Block Toggle Off', 'PASS', 'Code block markers removed');
        } else {
            addResult('Code Block Toggle Off', 'FAIL', `Code block markers still present`);
        }

        // Horizontal line
        await page.click('button[title="水平线"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/13-hr-added.png' });
        if (content.includes('---')) {
            addResult('Horizontal Line Add', 'PASS', '--- added');
        } else {
            addResult('Horizontal Line Add', 'FAIL', `Expected ---, got: ${content}`);
        }

        // Toggle hr off
        await page.click('button[title="水平线"]');
        content = await editor.inputValue();
        if (!content.includes('---')) {
            addResult('Horizontal Line Toggle Off', 'PASS', '--- removed');
        } else {
            addResult('Horizontal Line Toggle Off', 'FAIL', `--- still present`);
        }

        // Unordered list
        await page.click('button[title="无序列表"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/14-ul-added.png' });
        if (content.includes('- ')) {
            addResult('Unordered List Add', 'PASS', '- marker added');
        } else {
            addResult('Unordered List Add', 'FAIL', `Expected - , got: ${content}`);
        }

        // Toggle ul off
        await page.click('button[title="无序列表"]');
        content = await editor.inputValue();
        if (!content.includes('- ')) {
            addResult('Unordered List Toggle Off', 'PASS', '- marker removed');
        } else {
            addResult('Unordered List Toggle Off', 'FAIL', `- marker still present`);
        }

        // Ordered list
        await page.click('button[title="有序列表"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/15-ol-added.png' });
        if (content.includes('1. ')) {
            addResult('Ordered List Add', 'PASS', '1. marker added');
        } else {
            addResult('Ordered List Add', 'FAIL', `Expected 1. , got: ${content}`);
        }

        // Toggle ol off
        await page.click('button[title="有序列表"]');
        content = await editor.inputValue();
        if (!content.includes('1. ')) {
            addResult('Ordered List Toggle Off', 'PASS', '1. marker removed');
        } else {
            addResult('Ordered List Toggle Off', 'FAIL', `1. marker still present`);
        }

        // Task list
        await page.click('button[title="任务列表"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/16-task-added.png' });
        if (content.includes('[ ] ')) {
            addResult('Task List Add', 'PASS', '[ ] marker added');
        } else {
            addResult('Task List Add', 'FAIL', `Expected [ ] , got: ${content}`);
        }

        // Test 9: Heading switching
        console.log('\n=== Test: Heading Switching ===');
        await editor.fill('测试标题');
        await editor.selectText();
        await page.click('button[title="一级标题"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/17-h1-added.png' });
        if (content.includes('== 测试标题') || content.includes('===')) {
            addResult('H1 Apply', 'PASS', 'H1 marker added');
        } else {
            addResult('H1 Apply', 'FAIL', `Expected === or == , got: ${content}`);
        }

        // Switch to H2
        await editor.selectText();
        await page.click('button[title="二级标题"]');
        content = await editor.inputValue();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/18-h2-switched.png' });
        if (content.includes('== 测试标题')) {
            addResult('H2 Switch', 'PASS', 'Switched to H2 marker');
        } else {
            addResult('H2 Switch', 'FAIL', `Expected == , got: ${content}`);
        }

        // Test 10: Preview functionality
        console.log('\n=== Test: Preview Functionality ===');
        await editor.fill('**粗体文字**\n*斜体文字*\n```\n代码块\n```\n[链接](http://example.com)\n![图片](http://example.com/img.png)\n| 表头 | 表头 |\n| --- | --- |\n| 单元格 | 单元格 |\n$数学公式$');
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/19-preview-content.png' });

        const preview = page.locator('#preview');
        const previewHtml = await preview.innerHTML();
        console.log('Preview HTML:', previewHtml.substring(0, 500));

        // Check preview contains expected elements
        if (previewHtml.includes('<b>') || previewHtml.includes('bold')) {
            addResult('Preview Bold', 'PASS', 'Bold text rendered in preview');
        } else {
            addResult('Preview Bold', 'FAIL', 'Bold text not rendered');
        }

        if (previewHtml.includes('<i>') || previewHtml.includes('italic')) {
            addResult('Preview Italic', 'PASS', 'Italic text rendered in preview');
        } else {
            addResult('Preview Italic', 'FAIL', 'Italic text not rendered');
        }

        if (previewHtml.includes('<pre') || previewHtml.includes('code-block')) {
            addResult('Preview Code Block', 'PASS', 'Code block rendered in preview');
        } else {
            addResult('Preview Code Block', 'FAIL', 'Code block not rendered');
        }

        if (previewHtml.includes('<a ') || previewHtml.includes('url')) {
            addResult('Preview Link', 'PASS', 'Link rendered in preview');
        } else {
            addResult('Preview Link', 'FAIL', 'Link not rendered');
        }

        if (previewHtml.includes('<img') || previewHtml.includes('img')) {
            addResult('Preview Image', 'PASS', 'Image rendered in preview');
        } else {
            addResult('Preview Image', 'FAIL', 'Image not rendered');
        }

        if (previewHtml.includes('<table') || previewHtml.includes('table')) {
            addResult('Preview Table', 'PASS', 'Table rendered in preview');
        } else {
            addResult('Preview Table', 'FAIL', 'Table not rendered');
        }

        if (previewHtml.includes('math')) {
            addResult('Preview Math', 'PASS', 'Math formula rendered in preview');
        } else {
            addResult('Preview Math', 'FAIL', 'Math formula not rendered');
        }

        // Test 11: Theme toggle
        console.log('\n=== Test: Theme Toggle ===');
        const themeToggle = page.locator('#themeToggle');
        const initialTheme = await page.evaluate(() => document.body.getAttribute('data-theme'));
        await themeToggle.click();
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/20-dark-mode.png' });
        const newTheme = await page.evaluate(() => document.body.getAttribute('data-theme'));
        if (newTheme === 'dark') {
            addResult('Theme Toggle', 'PASS', 'Switched to dark theme');
        } else {
            addResult('Theme Toggle', 'FAIL', `Expected dark, got: ${newTheme}`);
        }

        // Toggle back to light
        await themeToggle.click();
        const lightTheme = await page.evaluate(() => document.body.getAttribute('data-theme'));
        if (!lightTheme || lightTheme === 'light') {
            addResult('Theme Toggle Back', 'PASS', 'Switched back to light theme');
        } else {
            addResult('Theme Toggle Back', 'FAIL', `Expected light, got: ${lightTheme}`);
        }

        // Final screenshot
        await page.screenshot({ path: '/Users/Zhuanz/wsx/public/qa-screenshots/21-final-state.png' });

    } catch (error) {
        console.error('Test error:', error);
        addResult('Test Execution', 'ERROR', error.message);
    } finally {
        await browser.close();
    }

    // Write results
    const fs = require('fs');
    fs.writeFileSync('/Users/Zhuanz/wsx/public/qa-screenshots/test-results.json', JSON.stringify(results, null, 2));
    console.log('\n=== Results Summary ===');
    const passed = results.tests.filter(t => t.status === 'PASS').length;
    const failed = results.tests.filter(t => t.status === 'FAIL').length;
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${results.tests.length}`);
    console.log('Results saved to public/qa-screenshots/test-results.json');
}

runTests();