import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const projectRoot = path.resolve('.');
const zipFilePath = path.join(projectRoot, 'eel-pwa-messenger.zip');
const artifactDir = `C:\\Users\\EmmanuelZeahn\\.gemini\\antigravity\\brain\\39722e10-8d45-4415-8d46-016ef13d11ce`;
const artifactZipPath = path.join(artifactDir, 'eel-pwa-messenger.zip');

const zip = new JSZip();

function addDirectoryToZip(dirPath, zipFolder) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'eel-pwa-messenger.zip') {
      continue;
    }

    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      const newZipFolder = zipFolder.folder(item);
      addDirectoryToZip(itemPath, newZipFolder);
    } else {
      const fileData = fs.readFileSync(itemPath);
      zipFolder.file(item, fileData);
    }
  }
}

console.log('📦 Generating eel-pwa-messenger.zip archive...');
addDirectoryToZip(projectRoot, zip);

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  .then((buffer) => {
    fs.writeFileSync(zipFilePath, buffer);
    console.log(`✅ Project zip file created at: ${zipFilePath}`);

    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(artifactZipPath, buffer);
      console.log(`✅ Mirrored zip archive to artifact dir: ${artifactZipPath}`);
    }
  })
  .catch((err) => {
    console.error('❌ Failed to generate zip archive:', err);
  });
