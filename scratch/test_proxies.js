async function testProxy(name, proxyUrlTemplate) {
  const targetUrl = 'https://photos.app.goo.gl/i7g6Xb2JAs3SnBqQ9';
  const proxyUrl = proxyUrlTemplate(targetUrl);
  console.log(`[${name}] Fetching: ${proxyUrl}`);
  try {
    const start = Date.now();
    const res = await fetch(proxyUrl);
    const html = await res.text();
    const duration = Date.now() - start;
    console.log(`[${name}] Status: ${res.status}, Length: ${html.length}, Time: ${duration}ms`);
    
    if (res.status === 200) {
      const regex = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
      const matches = html.match(regex) || [];
      console.log(`[${name}] Matches found: ${matches.length}`);
      if (matches.length > 0) {
        console.log(`[${name}] First match: ${matches[0]}`);
        return true;
      }
    }
  } catch (e) {
    console.log(`[${name}] Fetch error:`, e.message);
  }
  return false;
}

async function run() {
  const proxies = [
    { name: 'Thingproxy', template: url => `https://thingproxy.freeboard.io/fetch/${url}` },
    { name: 'Yacdn', template: url => `https://yacdn.org/serve/${url}` },
    { name: 'Codetabs', template: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
    { name: 'Allorigins_json', template: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` },
  ];

  for (const proxy of proxies) {
    const success = await testProxy(proxy.name, proxy.template);
    if (success) {
      console.log(`>>> ${proxy.name} works! <<<`);
    }
    console.log('------------------------------------------------');
  }
}

run();
