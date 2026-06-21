async function test() {
  const targetUrl = 'https://photos.app.goo.gl/i7g6Xb2JAs3SnBqQ9';
  const proxyUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&url=${encodeURIComponent(targetUrl)}`;
  console.log('Fetching via Google opensocial proxy:', proxyUrl);
  
  try {
    const res = await fetch(proxyUrl);
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Text length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
