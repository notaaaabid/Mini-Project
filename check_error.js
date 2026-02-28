import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log('PAGE LOG:', msg.text());
    });

    page.on('pageerror', err => {
        console.log('UNCAUGHT PAGE ERROR:', err.message);
    });

    await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });

    await page.screenshot({ path: 'check_error.png' });

    await browser.close();
})();
