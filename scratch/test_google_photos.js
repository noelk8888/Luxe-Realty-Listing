async function test() {
  const url = 'https://photos.app.goo.gl/i7g6Xb2JAs3SnBqQ9';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const html = await res.text();
  console.log('Final URL:', res.url);
  
  // Find all URLs starting with https://lh3.googleusercontent.com/
  // Google Photos image URLs typically look like:
  // https://lh3.googleusercontent.com/pw/AP1Gcz... or similar
  // Let's also check other domains like photos.google.com or googleusercontent
  const regex = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
  const matches = html.match(regex) || [];
  console.log('Matches (length):', matches.length);
  console.log('Unique matches:');
  const unique = [...new Set(matches)];
  unique.slice(0, 10).forEach(m => console.log(m));
}

test();
