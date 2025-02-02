const mongoose=require("mongoose");
const {Schema}=mongoose;



const replySchema = new Schema(
    {
      content: {
        type: String,
        required: true,
        trim: true,
      },
      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
      },
    },
    { timestamps: true }
  );
  

  const Reply=mongoose.model("Reply",replySchema);

  module.exports=Reply