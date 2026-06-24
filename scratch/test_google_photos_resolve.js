import fetch from 'node-fetch';

async function run() {
  const targetUrl = 'https://photos.app.goo.gl/gFVcVbRD7tnkFdtB6';
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log('HTML length:', html.length);

    // Let's print out all matches of googleusercontent links
    const regex1 = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
    const matches1 = html.match(regex1);
    console.log('Matches with /pw/:', matches1 ? matches1.slice(0, 5) : 'None');

    const regex2 = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/[a-zA-Z0-9_\-\/]+/g;
    const matches2 = html.match(regex2);
    console.log('Any googleusercontent matches:', matches2 ? matches2.slice(0, 5) : 'None');

  } catch (e) {
    console.error(e);
  }
}

run();
