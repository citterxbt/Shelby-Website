const { createCanvas } = require('canvas');

const canvas = createCanvas(128, 128);
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 128, 128);

const dataUrl = canvas.toDataURL('image/jpeg', 0.1);
console.log("Size:", dataUrl.length);
