$(document).ready(() => {
  const chunkSize = 2 * 1024 * 1024; // 每个chunk的大小，设置为2兆
  // 使用Blob.slice方法来对文件进行分割。
  // 同时该方法在不同的浏览器使用方式不同。
  const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
  const hashFile = (file) => {
    return new Promise((resolve, reject) => { 
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      function loadNext() {
        const start = currentChunk * chunkSize;
        const end = start + chunkSize >= file.size ? file.size : start + chunkSize;
        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
      }
      fileReader.onload = e => {
        spark.append(e.target.result); // Append array buffer
        currentChunk += 1;
        if (currentChunk < chunks) {
          loadNext();
        } else {
          console.log('finished loading');
          const result = spark.end();
          // 如果单纯的使用result 作为hash值的时候, 如果文件内容相同，而名称不同的时候
          // 想保留两个文件无法保留。所以把文件名称加上。
          const sparkMd5 = new SparkMD5();
          sparkMd5.append(result);
          sparkMd5.append(file.name);
          const hexHash = sparkMd5.end();
          resolve(hexHash);
        }
      };
      fileReader.onerror = () => {
        console.warn('文件读取失败！');
      };
      loadNext();
    }).catch(err => {
        console.log(err);
    });
  }
  const submitBtn = $('#submitBtn');
  submitBtn.on('click', async () => {
    const fileDom = $('#file')[0];
    // 获取到的files为一个File对象数组，如果允许多选的时候，文件为多个
    const files = fileDom.files;
    const file = files[0];
    if (!file) {
      alert('没有获取文件');
      return;
    }
    const blockCount = Math.ceil(file.size / chunkSize); // 分片总数
    const axiosPromiseArray = []; // axiosPromise数组
    const hash = await hashFile(file); //文件 hash 
    // 获取文件hash之后，如果需要做断点续传，可以根据hash值去后台进行校验。
    // 看看是否已经上传过该文件，并且是否已经传送完成以及已经上传的切片。
    console.log(hash);
    
    for (let i = 0; i < blockCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      // 构建表单
      const form = new FormData();
      form.append('file', blobSlice.call(file, start, end));
      form.append('name', file.name);
      form.append('total', blockCount);
      form.append('index', i);
      form.append('size', file.size);
      form.append('hash', hash);
      // ajax提交 分片，此时 content-type 为 multipart/form-data
      const axiosOptions = {
        onUploadProgress: e => {
          // 处理上传的进度
          console.log(blockCount, i, e, file);
        },
      };
      // 加入到 Promise 数组中
      axiosPromiseArray.push(axios.post('/file/upload', form, axiosOptions));
    }
    // 所有分片上传后，请求合并分片文件
    await axios.all(axiosPromiseArray).then(() => {
      // 合并chunks
      const data = {
        size: file.size,
        name: file.name,
        total: blockCount,
        hash
      };
      axios.post('/file/merge_chunks', data).then(res => {
        console.log('上传成功');
        console.log(res.data, file);
        alert('上传成功');
      }).catch(err => {
        console.log(err);
      });
    });
  });
})