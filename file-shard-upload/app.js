const Koa = require('koa');
const app = new Koa();
const Router = require('koa-router');
const multer = require('koa-multer');
const serve = require('koa-static');
const path = require('path');
const fs = require('fs-extra');
const koaBody = require('koa-body');

const { mkdirsSync } = require('./utils/dir');
const uploadPath = path.join(__dirname, 'uploads');
const uploadTempPath = path.join(uploadPath, 'temp');
const upload = multer({ dest: uploadTempPath });
const router = new Router();
app.use(koaBody());
/**
 * single(fieldname)
 * Accept a single file with the name fieldname. The single file will be stored in req.file.
 */
router.post('/file/upload', upload.single('file'), async (ctx, next) => {
  console.log('file upload...')
  // 根据文件hash创建文件夹，把默认上传的文件移动当前hash文件夹下。方便后续文件合并。
  const {
    name,
    total,
    index,
    size,
    hash
  } = ctx.req.body;

  const chunksPath = path.join(uploadPath, hash, '/');
  if(!fs.existsSync(chunksPath)) mkdirsSync(chunksPath);
  fs.renameSync(ctx.req.file.path, chunksPath + hash + '-' + index);
  ctx.status = 200;
  ctx.res.end('Success');
})

router.post('/file/merge_chunks', async (ctx, next) => {
  const {    
    size, 
    name, 
    total, 
    hash
  } = ctx.request.body;
  // 根据hash值，获取分片文件。
  // 创建存储文件
  // 合并
  const chunksPath = path.join(uploadPath, hash, '/');
  const filePath = path.join(uploadPath, name);
  // 读取所有的chunks 文件名存放在数组中
  const chunks = fs.readdirSync(chunksPath);
  // 创建存储文件
  fs.writeFileSync(filePath, ''); 
  if(chunks.length !== total || chunks.length === 0) {
    ctx.status = 200;
    ctx.res.end('切片文件数量不符合');
    return;
  }
  for (let i = 0; i < total; i++) {
    // 追加写入到文件中
    fs.appendFileSync(filePath, fs.readFileSync(chunksPath + hash + '-' +i));
    // 删除本次使用的chunk    
    fs.unlinkSync(chunksPath + hash + '-' +i);
  }
  fs.rmdirSync(chunksPath);
  // 文件合并成功，可以把文件信息进行入库。
  ctx.status = 200;
  ctx.res.end('合并成功');
})
app.use(router.routes());
app.use(router.allowedMethods());
app.use(serve(__dirname + '/static'));
app.listen(9000, () => {
  console.log('服务9000端口已经启动了');
});