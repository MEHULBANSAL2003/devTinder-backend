const express = require("express");
const { userAuth } = require("../middlewares/auth");
const Post = require("../models/post");
const User = require("../models/user");
const postRouter = express.Router();
const mongoose = require("mongoose");
const ConnectionRequestModel = require("../models/connectionRequests");

postRouter.post("/post/create", userAuth, async (req, res) => {
  const currUser = req.user;
  const { imageUrl, content } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!imageUrl) {
      throw { status: 400, message: "Image is required" };
    }

    const data = {
      imageUrl: imageUrl,
      postedBy: currUser._id,
    };
    if (content) data.content = content;

    const post = new Post(data);
    await post.save({ session });

    currUser.posts.push(post._id);
    await currUser.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      result: "success",
      message: "Posted successfully",
      data: post,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

postRouter.post("/post/delete/:postId", userAuth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const currUser = req.user;
    const postId = req.params.postId;
    const post = await Post.findById(postId).session(session);
    if (!post) {
      throw { status: 400, message: "No post exists" };
    }
    if (post.postedBy.toString() !== currUser._id.toString()) {
      throw { status: 400, message: "You are not the owner of this post" };
    }
    currUser.posts = currUser.posts.filter(
      (post) => post.toString() !== postId.toString()
    );
    const response = await currUser.save({ session });
    if (!response)
      throw { status: 400, message: "failed to update changes to user" };

    const deletedPost = await Post.findByIdAndDelete(postId).session(session);
    if (!deletedPost) {
      throw { status: 500, message: "Failed to delete the post from database" };
    }
    await session.commitTransaction();
    session.endSession();
    res.status(200).json({
      result: "success",
      message: "Post deleted successfully",
      data: deletedPost,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

postRouter.get("/posts", userAuth, async (req, res) => {
  try {
    const currUser = req.user;
    const pipeline = [
      {
        $match: { postedBy: { $ne: currUser._id } },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "users",
          localField: "postedBy",
          foreignField: "_id",
          as: "postedBy",
        },
      },
      {
        $unwind: "$postedBy",
      },
      {
        $lookup: {
          from: "users",
          localField: "likedBy",
          foreignField: "_id",
          as: "likedByDetails",
        },
      },
      {
        $project: {
          imageUrl: 1,
          content: 1,
          createdAt: 1,
          likedBy: 1,
          replies: 1,
          likedByDetails: 1,
          "postedBy.firstName": 1,
          "postedBy.lastName": 1,
          "postedBy.userName": 1,
          "postedBy.photoUrl": 1,
          "postedBy._id": 1,
        },
      },
    ];
    const posts = await Post.aggregate(pipeline);

    res.status(200).json({
      result: "success",
      message: "all posts fetched successfully",
      data: posts,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

postRouter.post("/post/:status/:postId", userAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const status = req.params.status;
    const currUser = req.user;
    const allowedStatus = ["like", "dislike"];
    if (!allowedStatus.includes(status)) {
      throw { status: 400, message: `invalid status type: ${status}` };
    }

    let post = await Post.findById(postId);
    if (!post) throw { status: 400, message: "no such posts exists" };

    const { userId } = req.body;
    if (userId !== currUser._id.toString())
      throw { status: 400, message: "user doesn't exists" };

    if (status === "like") {
      if (post.likedBy.some((id) => id.toString() === userId)) {
        throw { status: 400, message: "Already liked by you" };
      }
      post.likedBy.push(userId);
      await post.save();
    } else {
      if (!post.likedBy.includes(userId.toString()))
        throw { status: 400, message: "already not liked by you" };

      post.likedBy = post.likedBy.filter((id) => id.toString() !== userId);
      await post.save();
    }

    res.status(200).json({
      result: "success",
      message: `post ${status} succesfully`,
      data: post,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

postRouter.get("/post/:postId", userAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const objectId = new mongoose.Types.ObjectId(postId);
    const post = await Post.findById(postId);
    if (!post) throw { status: 400, message: "no such posts exists" };

    const postedById = post.postedBy;
    const currUserId = req.user._id;

    const connection = await ConnectionRequestModel.findOne({
      $or: [
        { toUserId: currUserId, fromUserId: postedById, status: "accepted" },
        { toUserId: postedById, fromUserId: currUserId, status: "accepted" },
      ],
    });

    if (!connection && postedById.toString() !== currUserId.toString())
      throw { status: 400, message: "not allowed to see private posts." };

    const pipeline = [
      {
        $match: {
          _id: objectId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "postedBy",
          foreignField: "_id",
          as: "postedBy",
        },
      },
      {
        $unwind: "$postedBy",
      },
      {
        $lookup: {
          from: "users",
          localField: "likedBy",
          foreignField: "_id",
          as: "likedByDetails",
        },
      },

      {
        $project: {
          imageUrl: 1,
          content: 1,
          createdAt: 1,
          likedBy: 1,
          replies: 1,
          likedByDetails: 1,
          "postedBy.firstName": 1,
          "postedBy.lastName": 1,
          "postedBy.userName": 1,
          "postedBy.photoUrl": 1,
          "postedBy._id": 1,
        },
      },
    ];

    const data = await Post.aggregate(pipeline);

    res.status(200).json({
      result: "success",
      message: "post data fetched successfully",
      data: data,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

postRouter.get("/post/likes/:postId", userAuth, async (req, res) => {
  try {
    const postId = req.params.postId;
    const objectId = new mongoose.Types.ObjectId(postId);
    let post = await Post.findById(postId);
    if (!post) throw { status: 400, message: "no such posts exists" };

    const postedById = post.postedBy;
    const currUserId = req.user._id;

    const connection = await ConnectionRequestModel.findOne({
      $or: [
        { toUserId: currUserId, fromUserId: postedById, status: "accepted" },
        { toUserId: postedById, fromUserId: currUserId, status: "accepted" },
      ],
    });

    if (!connection)
      throw { status: 400, message: "not allowed to see private posts." };

    const pipeline = [
      {
        $unwind: "$likedBy",
      },
      {
        $lookup: {
          from: "users",
          localField: "likedBy",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $project: {
          _id: 0,
          "userData.firstName": 1,
          "userData.lastName": 1,
          "userData.photoUrl": 1,
          "userData.userName": 1,
          "userData._id": 1,
        },
      },
    ];
    post = await Post.aggregate(pipeline);

    res.status(200).json({
      result: "success",
      message: "all likes fetched successfully",
      data: post,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

module.exports = { postRouter };
