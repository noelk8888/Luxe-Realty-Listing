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
    
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
    console.log('og:image:', ogImageMatch ? ogImageMatch[1] : 'None');

    const twitterImageMatch = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/);
    console.log('twitter:image:', twitterImageMatch ? twitterImageMatch[1] : 'None');

  } catch (e) {
    console.error(e);
  }
}

run();
