const mongoose = require("mongoose");

const connectDB = async () => {
  
  await mongoose.connect(process.env.MONGODB_URI,{
    minPoolSize:5,
    maxPoolSize:20,
    maxIdleTimeMS:30000,
    waitQueueTimeoutMS:5000
  });
};

module.exports={connectDB};


