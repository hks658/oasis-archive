const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Shared by the authenticated app and isolated local preview.
module.exports = function musicUploads(directory, urlPrefix) {
  fs.mkdirSync(directory, {recursive:true});
  const router = express.Router();
  const extensions = new Set(['.mp3','.wav','.ogg','.m4a','.aac','.flac']);
  const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:30*1024*1024,files:21},fileFilter(req,file,done) {
    if (file.fieldname === 'cover') return done(null,true); // sharp validates and re-encodes the image.
    if (file.fieldname === 'tracks' && extensions.has(path.extname(file.originalname).toLowerCase())) return done(null,true);
    done(new Error('请上传 MP3、WAV、OGG、M4A、AAC 或 FLAC 音频'));
  }}).fields([{name:'cover',maxCount:1},{name:'tracks',maxCount:20}]);
  router.post('/',(req,res) => upload(req,res,async error => {
    if (error) return res.status(400).json({error:error.code === 'LIMIT_FILE_SIZE' ? '每个文件不能超过 30 MB' : error.message});
    const written = [];
    try {
      const result = {cover:null,tracks:[]};
      if (req.files?.cover?.[0]) {
        const name = crypto.randomUUID()+'.webp';
        const output = path.join(directory,name); written.push(output);
        await sharp(req.files.cover[0].buffer).resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(output);
        result.cover = urlPrefix+'/'+name;
      }
      for (const file of req.files?.tracks || []) {
        const id = crypto.randomUUID();
        const name = id+path.extname(file.originalname).toLowerCase();
        const output = path.join(directory,name); written.push(output);
        await fs.promises.writeFile(output,file.buffer);
        result.tracks.push({id,src:urlPrefix+'/'+name});
      }
      res.json(result);
    } catch(error) {
      await Promise.allSettled(written.map(file => fs.promises.unlink(file)));
      res.status(400).json({error:'文件处理失败，请检查封面和音频格式'});
    }
  }));
  return router;
};
