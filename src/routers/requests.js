const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequestModel = require("../models/connectionRequests");
const {
  validateSendConnectionRequestData,
  validateRequestReviewData,
} = require("../utils/validation");
const User = require("../models/user");
const mongoose=require("mongoose");

const requestRouter = express.Router();

requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    try {
      await validateSendConnectionRequestData(req);

      const fromUserId = req.user._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const connectionRequest = new ConnectionRequestModel({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();

      res.json({
        result: "success",
        message: "Connection request sent succesfully",
        data: data,
      });
    } catch (err) {
      res.status(err.status || 500).json({
        result: "error",
        message: err.message || "Internal server error",
      });
    }
  }
);

requestRouter.post(
  "/request/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await validateRequestReviewData(req);

      const request = req.request;
      const currUser = req.user;

      request.status = req.params.status;

      if (request.status === "accepted") {
        const userUpdate = await User.findOneAndUpdate(
          { _id: currUser._id },
          { $inc: { connections: 1 } },
          { session }
        );

        if (!userUpdate) {
          throw { status: 400, message: "Error updating connections" };
        }
      }

      const updatedRequest = await request.save({ session });

      if (!updatedRequest) {
        throw { status: 400, message: "Failed to update the status" };
      }

      await session.commitTransaction();
      session.endSession();

      res.json({
        result: "success",
        message: `Connection request ${req.params.status}`,
        data: updatedRequest,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      res.status(err.status || 500).json({
        result: "error",
        message: err.message || "Internal server error",
      });
    }
  }
);

requestRouter.post("/request/cancel/:userId", userAuth, async (req, res) => {
  const toUserId = req.params.userId;
  const currUser = req.user._id;

  const user = await User.findById(toUserId);

  try {
    if (!user) throw { status: 400, message: "user doesnt exists" };
    const data = await ConnectionRequestModel.findOneAndDelete({
      fromUserId: currUser,
      toUserId: toUserId,
    });

    res.status(200).json({
      result: "success",
      message: "request cancelled successfully",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

requestRouter.post("/request/remove/:reqId", userAuth, async (req, res) => {
  const reqId = req.params.reqId;
  const currUser = req.user;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let request = await ConnectionRequestModel.findById(reqId);
    if (!request) throw { status: 400, message: "Invalid request id" };

    if (request.status !== "accepted") {
      throw { status: 400, message: "User is not your connection" };
    }
    request = await ConnectionRequestModel.findByIdAndDelete(reqId, {
      session,
    });

    if (!request) {
      throw {
        status: 400,
        message: "Invalid request. No matching connection found.",
      };
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: currUser._id },
      { $inc: { connections: -1 } },
      { session }
    );

    if (!updatedUser) {
      throw { status: 400, message: "Failed to update user" };
    }
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      result: "success",
      message: "Connection removed successfully",
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

module.exports = { requestRouter };
