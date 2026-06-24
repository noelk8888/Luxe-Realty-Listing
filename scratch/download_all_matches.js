import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function run() {
  const targetUrl = 'https://photos.app.goo.gl/xrBPEhK5jN2kexxr7';
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();

    const regex = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
    const matches = Array.from(new Set(html.match(regex) || []));
    console.log(`Found ${matches.length} unique /pw/ matches.`);

    for (let i = 0; i < matches.length; i++) {
      const imgUrl = matches[i] + '=w600';
      console.log(`Downloading Match #${i}: ${imgUrl}`);
      try {
        const imgRes = await fetch(imgUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.buffer();
          const filename = `scratch/match_${i}.jpg`;
          fs.writeFileSync(filename, buffer);
          console.log(`  Saved to ${filename} (size: ${buffer.length} bytes)`);
        } else {
          console.log(`  Failed to download: ${imgRes.status}`);
        }
      } catch (e) {
        console.error(`  Error downloading ${imgUrl}:`, e.message);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

run();
