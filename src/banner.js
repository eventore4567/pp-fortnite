import { deflateSync } from 'node:zlib';

// Bannière PNG autonome 1024 × 72 : aucun lien externe, aucune dépendance graphique.
const WIDTH=1024, HEIGHT=72;
const GLYPHS={
  'A':['01110','10001','10001','11111','10001','10001','10001'],
  'C':['01111','10000','10000','10000','10000','10000','01111'],
  'E':['11111','10000','10000','11110','10000','10000','11111'],
  'F':['11111','10000','10000','11110','10000','10000','10000'],
  'H':['10001','10001','10001','11111','10001','10001','10001'],
  'I':['11111','00100','00100','00100','00100','00100','11111'],
  'M':['10001','11011','10101','10101','10001','10001','10001'],
  'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'],
  'P':['11110','10001','10001','11110','10000','10000','10000'],
  'R':['11110','10001','10001','11110','10100','10010','10001'],
  'T':['11111','00100','00100','00100','00100','00100','00100'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) { crc^=byte; for(let i=0;i<8;i++) crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1; }
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
  const label=Buffer.from(type);
  const body=Buffer.concat([label,data]);
  const out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);
  body.copy(out,4); out.writeUInt32BE(crc32(body),8+data.length);
  return out;
}
function banner() {
  const raw=Buffer.alloc((WIDTH*4+1)*HEIGHT);
  const paint=(x,y,r,g,b,a=255)=>{
    if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return;
    const pos=y*(WIDTH*4+1)+1+x*4;
    raw[pos]=r;raw[pos+1]=g;raw[pos+2]=b;raw[pos+3]=a;
  };
  for(let y=0;y<HEIGHT;y++) {
    for(let x=0;x<WIDTH;x++) {
      const t=x/WIDTH, glow=Math.max(0,1-Math.abs(x-680)/400);
      paint(x,y,Math.floor(26+17*t+18*glow),Math.floor(24+8*t+12*glow),Math.floor(42+35*t+34*glow));
      if(y<3) paint(x,y,118,100,218);
      if(y>=HEIGHT-2) paint(x,y,73,66,128);
      if((x-y*4+1500)%173<2) paint(x,y,56,51,94);
    }
  }
  // Sigle géométrique violet sur fond sombre.
  for(let y=13;y<59;y++) for(let x=22;x<68;x++) {
    if(x===22||x===67||y===13||y===58) paint(x,y,139,123,247);
    else paint(x,y,58,48,111);
  }
  const drawText=(text,x,y,scale,color)=>{
    for(const letter of text) {
      const glyph=GLYPHS[letter]||GLYPHS[' '];
      for(let gy=0;gy<7;gy++) for(let gx=0;gx<5;gx++) if(glyph[gy][gx]==='1') {
        for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++)
          paint(x+gx*scale+sx,y+gy*scale+sy,...color);
      }
      x+=6*scale;
    }
  };
  drawText('PP',29,22,4,[239,238,255]);
  drawText('PP FORTNITE',92,18,5,[242,240,255]);
  drawText('MATCH CENTER',670,26,3,[188,180,235]);
  const header=Buffer.alloc(13);
  header.writeUInt32BE(WIDTH,0);header.writeUInt32BE(HEIGHT,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:8})),chunk('IEND',Buffer.alloc(0))]);
}
export const BANNER_PNG=banner();
