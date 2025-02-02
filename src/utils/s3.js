require("dotenv").config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});



const putObjectInS3 = async (filename, contentType) => {
  try {
    let keyy;
    if (contentType.startsWith("image/")) {
      keyy = `signup-images/${Date.now()}-${filename}`;
    } else {
      return { result: "error", message: "invalid content-type" };
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: keyy,
      ContentType: contentType,
    });

    let url = await getSignedUrl(client, command);

    if(url){
      return {
        status:200,
        result: "success",
        url: url,
        key: process.env.AWS_CLOUDFRONT_DOMAIN + "/" + keyy,
      };
      
    }
    else{
      return {status:400,result:"error",message:"some error occured"};
    }

    
  } catch (err) {
    return {status:500, result: "error", message: err.message };
  }
};

const deleteObjectFromS3=async(keyy)=>{

  try{
     const command=new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: keyy,

     })
     const response = await client.send(command); 
     return {
      result:"success",
       message:"deleted succesfully",
     }
  }
  catch(err){
    return { result:"error", message: 'Error deleting object from S3', error: err };

  }

}

module.exports = { putObjectInS3,deleteObjectFromS3 };
