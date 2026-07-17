// ============ ImgBB 图床上传类 ============
class ImgBBUploader {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async upload(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.apiKey}`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                return {
                    url: data.data.url,           // 原图链接
                    thumbnail: data.data.thumb.url, // 缩略图
                    deleteUrl: data.data.delete_url // 删除链接
                };
            } else {
                throw new Error('上传失败');
            }
        } catch (error) {
            console.error('ImgBB 上传失败:', error);
            throw error;
        }
    }
}
