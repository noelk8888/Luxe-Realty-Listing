import fs from 'fs';

async function download() {
  const url = 'https://photos.app.goo.gl/i7g6Xb2JAs3SnBqQ9';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const html = await res.text();
  
  const regex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
  const matches = html.match(regex) || [];
  const unique = [...new Set(matches)];
  
  if (unique.length > 0) {
    const imageUrl = unique[0] + '=w600'; // w600 makes it 600px wide
    console.log('Downloading first image URL:', imageUrl);
    const imgRes = await fetch(imageUrl);
    const buffer = await imgRes.arrayBuffer();
    fs.writeFileSync('/Users/noelk/repos/Luxe Listing/scratch/test_photo.jpg', Buffer.from(buffer));
    console.log('Saved to scratch/test_photo.jpg');
  } else {
    console.log('No images found!');
  }
}

download();
