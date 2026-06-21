async function test() {
  const targetUrl = 'https://photos.app.goo.gl/i7g6Xb2JAs3SnBqQ9';
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  console.log('Fetching from CORS proxy:', proxyUrl);
  
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();
    console.log('Status:', res.status);
    console.log('Length:', html.length);
    
    const regex = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
    const matches = html.match(regex) || [];
    console.log('Matches length:', matches.length);
    if (matches.length > 0) {
      console.log('First match:', matches[0]);
    } else {
      console.log('No matches. First 500 chars of HTML:', html.substring(0, 500));
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

test();
