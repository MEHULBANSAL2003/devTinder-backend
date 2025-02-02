const express = require("express");
const userRouter = express.Router();
const ConnectionRequestModel = require("../models/connectionRequests");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { userAuth } = require("../middlewares/auth");

// get all the pending connection requests for the logged in user
userRouter.get("/user/requests/recieved", userAuth, async (req, res) => {
  try {
    const currUser = req.user;

    const requests = await ConnectionRequestModel.find({
      toUserId: currUser._id,
      status: "interested",
    }).populate("fromUserId", ["firstName", "lastName", "photoUrl"]);

    res.json({
      result: "success",
      message: "requests fetched successfully",
      data: requests,
    });
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
  }
});

// get all the connections of loggedin user
userRouter.get("/user/connection", userAuth, async (req, res) => {
  try {
    const currUser = req.user;

    const connections = await ConnectionRequestModel.find({
      $or: [
        { toUserId: currUser._id, status: "accepted" },
        { fromUserId: currUser._id, status: "accepted" },
      ],
    })
      .populate("toUserId", "firstName lastName photoUrl userName")
      .populate("fromUserId", "firstName lastName photoUrl userName");

    const data = connections.map((row) => {
      if (row.fromUserId._id.equals(currUser._id)) {
        return {
          _id: row._id,
          user: row.toUserId,
        };
      }

      return {
        _id: row._id,
        user: row.fromUserId,
      };
    });

    res.json({
      result: "success",
      message: "succefully fetched the connections",
      data: data,
    });
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
  }
});

userRouter.get("/user/feed", userAuth, async (req, res) => {
  try {
    //user should see every card except his own... the one who are already friend and one whom he rejected or ignored already

    const currUser = req.user;

    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    limit = limit > 50 ? 50 : limit;

    let skip = (page - 1) * limit;

    const connections = await ConnectionRequestModel.find({
      $or: [{ toUserId: currUser._id }, { fromUserId: currUser._id }],
    });

    let notRequiredIds = [];
    notRequiredIds.push(currUser._id);

    connections.map((row) => {
      if (row.fromUserId.toString() === currUser._id.toString()) {
        notRequiredIds.push(row.toUserId);
      } else {  
        notRequiredIds.push(row.fromUserId);
      }
    });

    let data = await User.find({
      _id: { $nin: notRequiredIds },
    })
      .select("-password -email -createdAt -updatedAt -__v")
      .skip(skip)
      .limit(limit);

    res.json({
      result: "success",
      message: "all the users are fetched successfully",
      data: data,
    });
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
    
  }
});

userRouter.get("/user/search", userAuth, async (req, res) => {
  const searchKey = req.query.search;
  const regex = new RegExp("^" + searchKey, "i");

  const currUser = req.user;

  try {
    const connections = await ConnectionRequestModel.find({
      $or: [
        { toUserId: currUser._id, status: "accepted" },
        { fromUserId: currUser._id, status: "accepted" },
      ],
    })
      .populate("toUserId", "firstName lastName photoUrl userName")
      .populate("fromUserId", "firstName lastName photoUrl userName");

    const data = connections.map((row) => {
      let matchedUser = null;

      if (row.fromUserId._id.equals(currUser._id)) {
        if (
          regex.test(row.toUserId.firstName) ||
          regex.test(row.toUserId.lastName) ||
          regex.test(row.toUserId.userName)
        ) {
          matchedUser = {
            _id: row._id,
            user: row.toUserId,
          };
        }
      } else {
        if (
          regex.test(row.fromUserId.firstName) ||
          regex.test(row.fromUserId.lastName) ||
          regex.test(row.fromUserId.userName)
        ) {
          matchedUser = {
            _id: row._id,
            user: row.fromUserId,
          };
        }
      }

      return matchedUser;
    });

    const filteredData = data.filter((user) => user !== null);

    res.status(200).json({
      result: "success",
      data: filteredData,
    });
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
  }
});

userRouter.post("/user/change-password", userAuth, async (req, res) => {
  const currUser = req.user;
  const { currPass, newPass } = req.body;
  try {
    const isPasswordValid = await bcrypt.compare(currPass, currUser.password);

    if (!isPasswordValid) throw {status:400, message:"Current password is incorrect"}

    if (currPass === newPass)
      throw {status:400,message:"new password can't be same as that os old passwrord"};

    const hashedPassword = await bcrypt.hash(newPass, 10);

    const user = await User.findOneAndUpdate(
      { emailId: currUser.emailId },
      { password: hashedPassword }
    );

    res.status(200).json({
      result: "success",
      message: "password updated successfully",
    });
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
  }
});

module.exports = { userRouter };
