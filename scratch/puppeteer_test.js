import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log('Navigating...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  console.log('Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
})();
