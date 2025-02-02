const mongoose = require("mongoose");

const { Schema } = mongoose;


const postSchema = new Schema(
    {
      imageUrl:{
       type:"String",
       required:true,
      } , 
      content: {
        type: String,
        trim: true,
      },
      postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      likedBy: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User", 
        },
      ],
      replies: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Reply", 
        },
      ],
    },
    { timestamps: true }
  );

const Post= mongoose.model("Post",postSchema);

module.exports=Post;

  